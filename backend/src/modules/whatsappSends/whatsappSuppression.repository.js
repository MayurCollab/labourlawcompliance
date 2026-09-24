import WhatsAppSuppression from './whatsappSuppression.model.js';

export const findSuppressionByPhone = (phone) =>
  WhatsAppSuppression.findOne({ phone }).lean();

export const upsertSuppression = ({ phone, reason, sourceSendId, failureCode, notes }) =>
  WhatsAppSuppression.findOneAndUpdate(
    { phone },
    {
      $setOnInsert: { phone, suppressedAt: new Date() },
      $set: {
        reason: reason || 'opted_out',
        sourceSend: sourceSendId || null,
        failureCode: failureCode || null,
        notes: notes ?? null,
      },
    },
    { upsert: true, new: true },
  );

export const listSuppressions = ({ skip = 0, limit = 20 } = {}) =>
  WhatsAppSuppression.find({})
    .sort({ suppressedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

export const countSuppressions = () => WhatsAppSuppression.countDocuments({});

export const deleteSuppressionById = (id) =>
  WhatsAppSuppression.findByIdAndDelete(id);
