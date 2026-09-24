import mongoose from 'mongoose';

import WhatsAppSend from './whatsappSend.model.js';
import WhatsAppWebhookEvent from './whatsappWebhookEvent.model.js';

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

/**
 * Records a webhook event as processed. Returns true the first time a given
 * (providerMessageId, eventName) pair is seen, false on every duplicate —
 * the unique index makes this an atomic, race-safe dedupe check.
 */
export const recordWebhookEventOnce = async (providerMessageId, eventName) => {
  try {
    await WhatsAppWebhookEvent.create({ providerMessageId, eventName });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
};

/**
 * Most recent marketing send to this phone, for the pre-send pacing/cooldown
 * check. Utility (Form 5 reminder) sends don't count towards Meta's
 * marketing limits, so they're left out.
 */
export const findMostRecentMarketingSendToPhone = (phone, marketingBodyMode) =>
  WhatsAppSend.findOne({ phone, 'templateSnapshot.bodyMode': marketingBodyMode })
    .sort({ sentAt: -1 })
    .select('sentAt')
    .lean();

/** Sends currently due for a scheduled auto-retry. */
export const findDueRetries = (limit = 50) =>
  WhatsAppSend.find({
    retryState: 'scheduled',
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .limit(limit);

/** Aggregate pipelines don't auto-cast query values like find() does — cast `client` ObjectId refs by hand. */
const castObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return value;
  }
};

/** Failure-code volume breakdown for the observability view, same filter shape as listWhatsAppSends. */
export const aggregateFailuresByCategory = (filter = {}, since) => {
  const match = { ...filter, status: 'failed' };
  if (match.client) {
    match.client = Array.isArray(match.client?.$in)
      ? { $in: match.client.$in.map(castObjectId) }
      : castObjectId(match.client);
  }
  if (since) match.failedAt = { $gte: since };
  return WhatsAppSend.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ['$failureCategory', 'other'] },
        count: { $sum: 1 },
        lastSeenAt: { $max: '$failedAt' },
      },
    },
    { $sort: { count: -1 } },
  ]);
};
