import pRetry from 'p-retry';

import config from '../config/index.js';
import transporter from './transporter.js';

const SMTP_TIMEOUT_MS = 10_000;

/**
 * Low-level SMTP send with hard timeout + retry/backoff.
 */
export const sendEmailDirect = async ({ to, subject, html }) =>
  pRetry(
    async () => {
      const sendPromise = transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html,
      });

      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`SMTP timed out after ${SMTP_TIMEOUT_MS}ms`)),
          SMTP_TIMEOUT_MS,
        );
      });

      try {
        return await Promise.race([sendPromise, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 500,
      maxTimeout: 4000,
      randomize: true,
    },
  );
