import { Queue, Worker } from 'bullmq';
import pRetry from 'p-retry';

import config from '../config/index.js';
import { getRedis, isRedisEnabled } from '../config/redis.js';
import { emailJobsTotal } from '../observability/metrics.js';
import logger from '../utils/logger.js';
import EmailLog from './emailLog.model.js';
import { sendEmailDirect } from './sendEmailDirect.js';

const QUEUE_NAME = 'email';
const CONCURRENCY = 5;

/** @type {import('bullmq').Queue | null} */
let emailQueue = null;
/** @type {import('bullmq').Worker | null} */
let emailWorker = null;

const connectionOptions = () => {
  const redis = getRedis();
  if (!redis) return null;
  return redis;
};

export const getEmailQueue = () => {
  if (!isRedisEnabled()) return null;
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAME, {
      connection: connectionOptions(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return emailQueue;
};

/**
 * Enqueue one email job per recipient. Falls back to direct send (with
 * timeout + retry) when Redis is unavailable so registration never blocks.
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

  const queue = getEmailQueue();

  if (!queue || config.isTest) {
    try {
      await sendEmailDirect({ to, subject, html });
      log.status = 'sent';
      log.attempts = 1;
      log.sentAt = new Date();
      await log.save();
    } catch (err) {
      log.status = 'failed';
      log.attempts = 1;
      log.lastError = err.message;
      await log.save();
      logger.warn(
        `[email] Direct send failed for ${template} → ${to}: ${err.message}`,
      );
      throw err;
    }
    return log;
  }

  const job = await queue.add(
    template,
    {
      to,
      subject,
      html,
      template,
      emailLogId: String(log._id),
    },
    { jobId: `${template}:${log._id}` },
  );

  log.jobId = String(job.id);
  await log.save();
  return log;
};

export const startEmailWorker = () => {
  if (!isRedisEnabled() || config.isTest) {
    logger.info(
      '[email] Worker not started (Redis disabled or test env) — emails send inline',
    );
    return null;
  }

  if (emailWorker) return emailWorker;

  emailWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { to, subject, html, emailLogId } = job.data;
      const log = emailLogId ? await EmailLog.findById(emailLogId) : null;
      if (log) {
        log.status = 'active';
        log.attempts = job.attemptsMade + 1;
        await log.save();
      }

      await pRetry(() => sendEmailDirect({ to, subject, html }), {
        retries: 2,
        minTimeout: 500,
        maxTimeout: 5000,
      });

      if (log) {
        log.status = 'sent';
        log.sentAt = new Date();
        log.lastError = null;
        await log.save();
      }

      emailJobsTotal.inc({ status: 'sent' });
    },
    {
      connection: connectionOptions(),
      concurrency: CONCURRENCY,
    },
  );

  emailWorker.on('failed', async (job, err) => {
    emailJobsTotal.inc({ status: 'failed' });
    logger.error(
      `[email] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
    );
    if (job?.data?.emailLogId) {
      await EmailLog.findByIdAndUpdate(job.data.emailLogId, {
        status: 'failed',
        lastError: err.message,
        attempts: job.attemptsMade,
      });
    }
  });

  logger.info(`[email] BullMQ worker started (concurrency=${CONCURRENCY})`);
  return emailWorker;
};

export const stopEmailWorker = async () => {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
};
