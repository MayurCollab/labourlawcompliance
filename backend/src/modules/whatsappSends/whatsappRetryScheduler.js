import config from '../../config/index.js';
import { sendWhatsAppTemplateBatch } from '../../integrations/msg91/whatsapp.js';
import logger from '../../utils/logger.js';
import {
  classifyFailureText,
  getRetryPolicy,
  nextRetryDelayMs,
  WHATSAPP_FAILURE_CATEGORIES,
} from './whatsappFailureCodes.js';
import { extractProviderIds, isRecipientSuppressed } from './whatsappSends.service.js';
import * as whatsappSendsRepository from './whatsappSends.repository.js';

// Small gap between individual retry attempts within one sweep — the sweep
// IS the paced resend, so this only protects against hammering MSG91 when
// several sends come due at once.
const INTER_SEND_DELAY_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Applies the outcome of one retry attempt to its ledger row and saves it. */
const applyRetryOutcome = async (send, { ok, response, error }) => {
  if (ok) {
    const { requestId, providerMessageId } = extractProviderIds(response);
    if (requestId) send.requestId = requestId;
    if (providerMessageId) send.providerMessageId = providerMessageId;
    send.retryCount = (send.retryCount || 0) + 1;
    send.retryState = 'none';
    send.status = 'accepted';
    send.sentAt = new Date();
    send.nextRetryAt = null;
    send.providerResponse = {
      status: response?.status ?? response?.type ?? null,
      message: response?.message ?? null,
      requestId,
      providerMessageId,
    };
    logger.info('[whatsappRetryScheduler] Retry accepted', {
      sendId: String(send._id),
      phone: send.phone,
      attempt: send.retryCount,
    });
    await send.save();
    return;
  }

  const raw = error?.message || 'Retry failed';
  const { code, category } = classifyFailureText(raw);
  send.retryCount = (send.retryCount || 0) + 1;
  send.errorMessage = raw.slice(0, 500);
  send.failureCode = code || send.failureCode;
  send.failureCategory = category || send.failureCategory;
  send.status = 'failed';
  send.failedAt = new Date();

  const delayMs = nextRetryDelayMs(
    send.failureCategory || WHATSAPP_FAILURE_CATEGORIES.OTHER,
    send.retryCount,
  );
  if (delayMs != null) {
    send.retryState = 'scheduled';
    send.nextRetryAt = new Date(Date.now() + delayMs);
  } else {
    send.retryState = 'exhausted';
    send.nextRetryAt = null;
  }

  logger.warn('[whatsappRetryScheduler] Retry failed', {
    sendId: String(send._id),
    phone: send.phone,
    attempt: send.retryCount,
    failureCategory: send.failureCategory,
    retryState: send.retryState,
  });
  await send.save();
};

/** Attempts one due retry. Never throws — failures are recorded on the send itself. */
const attemptRetry = async (send) => {
  // Opt-outs only block marketing templates — a utility (Form 5 reminder)
  // retry still goes to an opted-out contact.
  if (await isRecipientSuppressed(send.phone, send.templateSnapshot)) {
    send.retryState = 'suppressed';
    send.nextRetryAt = null;
    await send.save();
    return;
  }

  const policy = getRetryPolicy(send.failureCategory);
  if ((send.retryCount || 0) >= policy.maxAttempts) {
    send.retryState = 'exhausted';
    send.nextRetryAt = null;
    await send.save();
    return;
  }

  if (!send.templateSnapshot?.msg91TemplateName || !Array.isArray(send.bodyValues)) {
    // Sends recorded before bodyValues/templateSnapshot were persisted can't
    // be safely re-sent — flag for manual follow-up instead of guessing.
    send.retryState = 'exhausted';
    send.nextRetryAt = null;
    logger.warn('[whatsappRetryScheduler] Missing data for retry, exhausting', {
      sendId: String(send._id),
    });
    await send.save();
    return;
  }

  try {
    const result = await sendWhatsAppTemplateBatch({
      template: {
        name: send.templateSnapshot.msg91TemplateName,
        namespace: send.templateSnapshot.namespace,
        language: send.templateSnapshot.languageCode || 'en',
      },
      entries: [
        {
          to: [send.phone],
          filename: send.filename,
          mediaUrl: send.mediaUrl,
          bodyValues: send.bodyValues,
        },
      ],
    });

    const chunk = result.chunks?.[0];
    if (chunk?.ok) {
      await applyRetryOutcome(send, { ok: true, response: chunk.response });
    } else {
      await applyRetryOutcome(send, { ok: false, error: chunk?.error });
    }
  } catch (error) {
    await applyRetryOutcome(send, { ok: false, error });
  }
};

let isRunning = false;

/** One sweep: process every send currently due for an auto-retry. */
export const runWhatsAppRetrySweep = async () => {
  if (isRunning) return { skipped: true };
  isRunning = true;
  let processed = 0;
  try {
    const due = await whatsappSendsRepository.findDueRetries(50);
    for (const send of due) {
      // eslint-disable-next-line no-await-in-loop
      await attemptRetry(send);
      processed += 1;
      // eslint-disable-next-line no-await-in-loop
      if (due.length > 1) await sleep(INTER_SEND_DELAY_MS);
    }
    return { processed };
  } catch (error) {
    logger.error(`[whatsappRetryScheduler] Sweep failed: ${error.message}`);
    return { processed, error: error.message };
  } finally {
    isRunning = false;
  }
};

let intervalHandle = null;

/** Starts the periodic sweep. Single in-process interval — no distributed lock needed (single-instance deployment). */
export const startWhatsAppRetryScheduler = () => {
  if (intervalHandle) return intervalHandle;
  const intervalMs = config.msg91.retrySweepIntervalMs;
  intervalHandle = setInterval(() => {
    runWhatsAppRetrySweep().catch((error) =>
      logger.error(`[whatsappRetryScheduler] Unhandled sweep error: ${error.message}`),
    );
  }, intervalMs);
  intervalHandle.unref?.();
  logger.info(`[whatsappRetryScheduler] Started (interval ${intervalMs}ms)`);
  return intervalHandle;
};

export const stopWhatsAppRetryScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
