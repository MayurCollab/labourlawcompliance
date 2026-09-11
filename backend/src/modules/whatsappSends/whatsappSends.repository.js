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
  if (requestId) {
    const byRequest = await WhatsAppSend.findOne({ requestId }).sort({
      sentAt: -1,
    });
    if (byRequest) return byRequest;
  }

  if (providerMessageId) {
    const byProvider = await WhatsAppSend.findOne({
      providerMessageId,
    }).sort({ sentAt: -1 });
    if (byProvider) return byProvider;
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
