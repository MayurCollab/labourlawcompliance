import WhatsAppSend from './whatsappSend.model.js';

const CLIENT_POPULATE = {
  path: 'client',
  select: 'clientCode companyName location',
  populate: {
    path: 'location',
    select: 'name',
  },
};

const ACTOR_POPULATE = {
  path: 'actorId',
  select: 'name email',
};

export const createWhatsAppSend = (doc) => WhatsAppSend.create(doc);

export const findWhatsAppSends = (filter, { sort, skip, limit }) =>
  WhatsAppSend.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(CLIENT_POPULATE)
    .populate(ACTOR_POPULATE)
    .lean();

export const countWhatsAppSends = (filter = {}) =>
  WhatsAppSend.countDocuments(filter);

export const findWhatsAppSendById = (id) =>
  WhatsAppSend.findById(id)
    .populate(CLIENT_POPULATE)
    .populate(ACTOR_POPULATE);

/**
 * Resolve a send for webhook correlation. Prefer requestId, then
 * providerMessageId, then newest send to the same phone.
 */
export const findWhatsAppSendForWebhook = async ({
  requestId,
  providerMessageId,
  phone,
}) => {
  // A bulk MSG91 request id is shared by every recipient in that call, so
  // narrow by phone first and never guess between several rows.
  if (requestId) {
    if (phone) {
      const exact = await WhatsAppSend.findOne({ requestId, phone }).sort({
        sentAt: -1,
      });
      if (exact) return exact;
    }
    const byRequest = await WhatsAppSend.find({ requestId })
      .sort({ sentAt: -1 })
      .limit(2);
    if (byRequest.length === 1) return byRequest[0];
  }

  if (providerMessageId) {
    if (phone) {
      const exact = await WhatsAppSend.findOne({
        providerMessageId,
        phone,
      }).sort({ sentAt: -1 });
      if (exact) return exact;
    }
    const byProvider = await WhatsAppSend.find({ providerMessageId })
      .sort({ sentAt: -1 })
      .limit(2);
    if (byProvider.length === 1) return byProvider[0];
  }

  if (phone) {
    return WhatsAppSend.findOne({ phone }).sort({ sentAt: -1 });
  }

  return null;
};

export const saveWhatsAppSend = (send) => send.save();

const OPEN_STATUSES = ['accepted', 'sent', 'delivered'];

/**
 * Recent sends that can still move (accepted → sent → delivered → read).
 */
export const findOpenWhatsAppSendsSince = (since, limit = 500) =>
  WhatsAppSend.find({
    status: { $in: OPEN_STATUSES },
    sentAt: { $gte: since },
  })
    .select('requestId providerMessageId phone sentAt status')
    .sort({ sentAt: 1 })
    .limit(limit)
    .lean();

export const deleteWhatsAppSendById = (id) => WhatsAppSend.findByIdAndDelete(id);
