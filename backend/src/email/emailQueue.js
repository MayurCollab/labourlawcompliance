import { emailJobsTotal } from '../observability/metrics.js';
import logger from '../utils/logger.js';
import EmailLog from './emailLog.model.js';
import { sendEmailDirect } from './sendEmailDirect.js';

/**
 * Send one email per recipient inline (with SMTP timeout + retry via sendEmailDirect).
 * Keeps an EmailLog audit row for operational queries.
 */
export const enqueueEmail = async ({
  to,
  subject,
  html,
  template,
  userId = null,
  meta = {},
}) => {
  const log = await EmailLog.create({
    to,
    subject,
    template,
    status: 'queued',
    userId,
    meta,
  });

  try {
    await sendEmailDirect({ to, subject, html });
    log.status = 'sent';
    log.attempts = 1;
    log.sentAt = new Date();
    await log.save();
    emailJobsTotal.inc({ status: 'sent' });
  } catch (err) {
    log.status = 'failed';
    log.attempts = 1;
    log.lastError = err.message;
    await log.save();
    emailJobsTotal.inc({ status: 'failed' });
    logger.warn(
      `[email] Direct send failed for ${template} → ${to}: ${err.message}`,
    );
    throw err;
  }

  return log;
};

/** No background worker — emails send inline in enqueueEmail. */
export const startEmailWorker = () => {
  logger.info('[email] Inline SMTP sends (no queue worker)');
  return null;
};

export const stopEmailWorker = async () => {};
