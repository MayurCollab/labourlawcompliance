import EmailLog from './emailLog.model.js';

export const findEmailLogsForUser = (userId, email) =>
  EmailLog.find({ $or: [{ userId }, { to: email }] })
    .select('template subject status attempts sentAt createdAt')
    .sort({ createdAt: -1 })
    .lean();

/**
 * Email logs record a recipient address, so they are personal data and must
 * go when a user is erased.
 */
export const deleteEmailLogsForUser = (userId, email, session = null) =>
  EmailLog.deleteMany({ $or: [{ userId }, { to: email }] }, { session });
