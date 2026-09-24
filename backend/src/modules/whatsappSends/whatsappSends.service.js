import config from '../../config/index.js';
import { fetchWhatsAppOutboundLogs } from '../../integrations/msg91/whatsapp.js';
import { normalizeWhatsAppPhone } from '../../integrations/msg91/phone.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';
import { getRequestContext } from '../../utils/requestContext.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import { WHATSAPP_BODY_MODES } from '../whatsappTemplates/whatsappTemplates.constants.js';
import {
  WHATSAPP_SEND_STATUSES,
  WHATSAPP_SEND_STATUS_RANK,
  WHATSAPP_SENDS_CODES,
} from './whatsappSends.constants.js';
import {
  classifyFailureText,
  nextRetryDelayMs,
  userFacingErrorMessage,
  WHATSAPP_FAILURE_CATEGORIES,
} from './whatsappFailureCodes.js';
import { toWhatsAppSendDto, toWhatsAppSendListDto } from './whatsappSends.dto.js';
import * as whatsappSendsRepository from './whatsappSends.repository.js';
import * as whatsappSuppressionRepository from './whatsappSuppression.repository.js';
import { escapeRegex, exactMatchRegex, splitSearchTokens } from '../../utils/searchTokens.js';

const pickFirstString = (...candidates) => {
  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

/**
 * Pull correlation ids from MSG91 accept / webhook payloads (new + legacy shapes).
 */
export const extractProviderIds = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { requestId: null, providerMessageId: null };
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const firstRow = Array.isArray(data) ? data[0] : null;
  const nested =
    firstRow && typeof firstRow === 'object'
      ? firstRow
      : data.result && typeof data.result === 'object'
        ? data.result
        : {};

  const requestId = pickFirstString(
    payload.requestId,
    payload.request_id,
    data.requestId,
    data.request_id,
    nested.requestId,
    nested.request_id,
    payload.campaign_request_id,
    data.campaign_request_id,
  );

  const providerMessageId = pickFirstString(
    payload.uuid,
    payload.message_uuid,
    payload.messageUuid,
    payload.providerMessageId,
    data.uuid,
    data.message_uuid,
    data.messageUuid,
    nested.uuid,
    nested.message_uuid,
    nested.messageUuid,
    nested.id,
  );

  return { requestId, providerMessageId };
};

const summarizeProviderResponse = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const { requestId, providerMessageId } = extractProviderIds(payload);
  return {
    status: payload.status ?? payload.type ?? null,
    message: payload.message ?? null,
    requestId,
    providerMessageId,
  };
};

const normalizeWebhookStatus = (raw) => {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!value) return null;

  if (value === 'read' || value === 'seen') return WHATSAPP_SEND_STATUSES.READ;
  if (value === 'delivered' || value === 'delivery') {
    return WHATSAPP_SEND_STATUSES.DELIVERED;
  }
  if (
    value === 'failed' ||
    value === 'failure' ||
    value === 'undelivered' ||
    value.startsWith('failed')
  ) {
    return WHATSAPP_SEND_STATUSES.FAILED;
  }
  if (value === 'sent' || value === 'submit' || value === 'submitted') {
    return WHATSAPP_SEND_STATUSES.SENT;
  }
  if (value === 'accepted' || value === 'queued' || value === 'pending') {
    return WHATSAPP_SEND_STATUSES.ACCEPTED;
  }
  return null;
};

const parseWebhookTimestamp = (...candidates) => {
  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue;
    const unwrapped =
      typeof value === 'object' &&
      !(value instanceof Date) &&
      value.value !== undefined &&
      value.value !== null
        ? value.value
        : value;
    if (unwrapped === undefined || unwrapped === null || unwrapped === '') continue;
    if (unwrapped instanceof Date && !Number.isNaN(unwrapped.getTime())) {
      return unwrapped;
    }
    if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) {
      const ms = unwrapped < 1e12 ? unwrapped * 1000 : unwrapped;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date;
    }
    const text = String(unwrapped).trim();
    if (/^\d+$/.test(text)) {
      const num = Number(text);
      const ms = num < 1e12 ? num * 1000 : num;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date;
    }
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const canAdvanceStatus = (current, next) => {
  if (!next) return false;
  if (next === WHATSAPP_SEND_STATUSES.FAILED) return true;
  if (current === WHATSAPP_SEND_STATUSES.FAILED) return false;
  const currentRank = WHATSAPP_SEND_STATUS_RANK[current] ?? 0;
  const nextRank = WHATSAPP_SEND_STATUS_RANK[next] ?? 0;
  return nextRank >= currentRank;
};

const normalizePhoneDigits = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
};

/**
 * Never throws — send path must keep working even if ledger write fails.
 */
export const recordWhatsAppSend = async (input) => {
  try {
    const ctx = getRequestContext() || {};
    const { requestId, providerMessageId } = extractProviderIds(
      input.providerResponse,
    );

    const isFailed = input.status === WHATSAPP_SEND_STATUSES.FAILED;
    const { code: failureCode, category: failureCategory } = isFailed
      ? classifyFailureText(input.errorMessage)
      : { code: null, category: null };

    const doc = {
      filing: input.filingId ?? null,
      client: input.clientId ?? null,
      clientCode: input.clientCode ?? null,
      companyName: input.companyName ?? null,
      phone: input.phone,
      period: input.period ?? null,
      periodLabel: input.periodLabel ?? null,
      filename: input.filename ?? null,
      mediaUrl: input.mediaUrl ?? null,
      templateName:
        input.templateName ??
        input.templateSnapshot?.msg91TemplateName ??
        config.msg91.templateName ??
        null,
      whatsappTemplate: input.whatsappTemplateId ?? null,
      templateSnapshot: input.templateSnapshot ?? null,
      bodyValues: Array.isArray(input.bodyValues) ? input.bodyValues : null,
      status: input.status || WHATSAPP_SEND_STATUSES.ACCEPTED,
      requestId: input.requestId ?? requestId,
      providerMessageId: input.providerMessageId ?? providerMessageId,
      errorMessage: input.errorMessage
        ? String(input.errorMessage).slice(0, 500)
        : null,
      failureCode,
      failureCategory,
      providerResponse: summarizeProviderResponse(input.providerResponse),
      sentAt: input.sentAt || new Date(),
      deliveredAt: input.deliveredAt ?? null,
      readAt: input.readAt ?? null,
      failedAt: isFailed ? input.failedAt || new Date() : null,
      statusUpdatedAt: new Date(),
      actorId: input.actorId ?? ctx.userId ?? null,
      actorEmail: input.actorEmail ?? ctx.userEmail ?? null,
    };

    if (isFailed && failureCategory === WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT) {
      doc.retryState = 'suppressed';
    } else if (isFailed) {
      const delayMs = nextRetryDelayMs(failureCategory, 0);
      if (delayMs != null) {
        doc.retryState = 'scheduled';
        doc.nextRetryAt = new Date(doc.failedAt.getTime() + delayMs);
      } else {
        doc.retryState = 'exhausted';
      }
    }

    const created = await whatsappSendsRepository.createWhatsAppSend(doc);

    if (isFailed && failureCategory === WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT) {
      await whatsappSuppressionRepository.upsertSuppression({
        phone: input.phone,
        reason: 'opted_out',
        sourceSendId: created._id,
        failureCode,
      });
    }
  } catch (err) {
    logger.error(
      `[whatsappSends] Failed to record send: ${err.message}`,
    );
  }
};

const sendCooldownMs = () =>
  (Number(config.msg91.sendCooldownHours) || 24) * 60 * 60 * 1000;

/**
 * True if sending `template` to `phone` is blocked by the permanent WhatsApp
 * suppression list (131050 opt-outs, or manual). 131050 is an opt-out from
 * marketing only — utility templates (the Form 5 reminder) still reach the
 * contact, so they're never blocked here.
 */
export const isRecipientSuppressed = async (phone, template) => {
  if (!isMarketingTemplate(template)) return false;
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return false;
  const suppression = await whatsappSuppressionRepository.findSuppressionByPhone(digits);
  return Boolean(suppression);
};

/** Throwing counterpart of isRecipientSuppressed. Call before any single-recipient send. */
export const assertRecipientNotSuppressed = async (phone, template) => {
  if (await isRecipientSuppressed(phone, template)) {
    throw new AppError(
      'This contact has opted out of WhatsApp messages and cannot be sent to.',
      422,
      { code: WHATSAPP_SENDS_CODES.RECIPIENT_SUPPRESSED },
    );
  }
};

/**
 * Only marketing templates are paced. Meta's per-recipient limits
 * (131049/131056/130429) apply to marketing sends; the fixed Form 5 reminder
 * is approved as a utility template and may go to the same number freely.
 * Every 'single' (message-only) template is a marketing template, the
 * 'positional' Form 5 reminder is the utility one.
 */
export const isMarketingTemplate = (template) =>
  template?.bodyMode === WHATSAPP_BODY_MODES.SINGLE;

/**
 * True if sending `template` to `phone` now would repeat a marketing send
 * inside the pacing cooldown window — the repeated-send-to-one-recipient
 * pattern that triggers 131049/131056/130429. Utility templates are never
 * held back, and earlier utility sends don't count towards the window.
 * Pass `force: true` for the retry scheduler's own resends, which are the
 * intentional exception to this check.
 */
export const isRecipientInSendCooldown = async (
  phone,
  { template, force = false } = {},
) => {
  if (force || !isMarketingTemplate(template)) return false;
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return false;
  const recent = await whatsappSendsRepository.findMostRecentMarketingSendToPhone(
    digits,
    WHATSAPP_BODY_MODES.SINGLE,
  );
  if (!recent?.sentAt) return false;
  return Date.now() - new Date(recent.sentAt).getTime() < sendCooldownMs();
};

/** Throwing counterpart of isRecipientInSendCooldown, for single-recipient send paths. */
export const assertRecipientNotInCooldown = async (phone, template) => {
  if (await isRecipientInSendCooldown(phone, { template })) {
    throw new AppError(
      "A WhatsApp message was already sent to this contact recently. Please wait before sending again to protect delivery health.",
      429,
      { code: WHATSAPP_SENDS_CODES.RECENTLY_SENT },
    );
  }
};

/** Period/client/location scoping shared by the sends list and the failure summary. */
const buildScopeFilter = async ({
  period,
  clientId,
  clientIds,
  locationId,
  locationIds,
}) => {
  const filter = {};

  if (period) filter.period = period;

  const clients = [
    ...new Set(
      [...(Array.isArray(clientIds) ? clientIds : []), clientId]
        .filter(Boolean)
        .map(String),
    ),
  ];
  const locations = [
    ...new Set(
      [...(Array.isArray(locationIds) ? locationIds : []), locationId]
        .filter(Boolean)
        .map(String),
    ),
  ];

  if (locations.length) {
    const inLocations = (
      await clientsRepository.findClientIdsByLocations(locations)
    ).map(String);
    const allowed = new Set(inLocations);
    const scoped = clients.length
      ? clients.filter((id) => allowed.has(id))
      : inLocations;
    filter.client = { $in: scoped };
  } else if (clients.length === 1) {
    filter.client = clients[0];
  } else if (clients.length > 1) {
    filter.client = { $in: clients };
  }

  return filter;
};

export const listWhatsAppSends = async (query) => {
  const {
    page,
    limit,
    search,
    period,
    clientId,
    clientIds,
    locationId,
    locationIds,
    status,
    phone,
    sortBy,
    sortOrder,
  } = query;

  const filter = await buildScopeFilter({
    period,
    clientId,
    clientIds,
    locationId,
    locationIds,
  });

  if (search) {
    const tokens = splitSearchTokens(search);
    // Pasted list (e.g. client codes or company names copied from Excel) —
    // exact match per field, checked across every searchable field.
    const regex =
      tokens.length > 1
        ? exactMatchRegex(tokens)
        : { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [
      { phone: regex },
      { clientCode: regex },
      { companyName: regex },
      { filename: regex },
      { requestId: regex },
      { providerMessageId: regex },
    ];
  }

  if (status) filter.status = status;

  if (phone) {
    const digits = normalizePhoneDigits(phone);
    if (digits) {
      filter.phone = { $regex: `${escapeRegex(digits)}$` };
    }
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [sends, total] = await Promise.all([
    whatsappSendsRepository.findWhatsAppSends(filter, { sort, skip, limit }),
    whatsappSendsRepository.countWhatsAppSends(filter),
  ]);

  return {
    sends: toWhatsAppSendListDto(sends),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getWhatsAppSend = async (id) => {
  const send = await whatsappSendsRepository.findWhatsAppSendById(id);
  if (!send) return null;
  return toWhatsAppSendDto(send);
};

/**
 * Apply MSG91 outbound delivery report (new or legacy webhook payload).
 * Returns { matched, send } without throwing for unknown messages.
 * Pass `{ quiet: true }` to skip unmatched-send info logs (bulk refresh).
 */
export const applyWhatsAppStatusWebhook = async (rawBody, options = {}) => {
  const body = Array.isArray(rawBody) ? rawBody[0] : rawBody;
  if (!body || typeof body !== 'object') {
    return { matched: false, reason: 'empty_payload' };
  }

  const eventName = pickFirstString(
    body.eventName,
    body.event_name,
    body.status,
    body.event,
  );
  const nextStatus = normalizeWebhookStatus(eventName);
  const { requestId, providerMessageId } = extractProviderIds(body);
  const phone = normalizePhoneDigits(
    pickFirstString(
      body.customerNumber,
      body.customer_number,
      body.phone,
      body.to,
      body.recipient,
    ),
  );

  // MSG91 documents duplicate webhook deliveries for the same WAMID as
  // expected behavior — dedupe by (providerMessageId, eventName) before any
  // status change or retry is triggered. Payloads without a providerMessageId
  // (older/legacy shapes) skip dedup rather than being silently dropped.
  if (providerMessageId && eventName) {
    const isNewEvent = await whatsappSendsRepository.recordWebhookEventOnce(
      providerMessageId,
      eventName,
    );
    if (!isNewEvent) {
      return { matched: true, changed: false, deduped: true };
    }
  }

  const send = await whatsappSendsRepository.findWhatsAppSendForWebhook({
    requestId,
    providerMessageId,
    phone,
  });

  if (!send) {
    if (!options.quiet) {
      logger.info('[whatsappSends] Webhook with no matching send', {
        requestId,
        providerMessageId,
        phone,
        eventName,
      });
    }
    return { matched: false, reason: 'not_found' };
  }

  let changed = false;

  if (requestId && !send.requestId) {
    send.requestId = requestId;
    changed = true;
  }
  if (providerMessageId && !send.providerMessageId) {
    send.providerMessageId = providerMessageId;
    changed = true;
  }

  const eventAt =
    parseWebhookTimestamp(
      body.ts,
      body.timestamp,
      body.read_at,
      body.readAt,
      body.delivered_at,
      body.deliveredAt,
      body.submitted_at,
      body.submittedAt,
      body.failed_at,
      body.failedAt,
    ) || new Date();

  if (nextStatus && canAdvanceStatus(send.status, nextStatus)) {
    send.status = nextStatus;
    send.statusUpdatedAt = eventAt;
    changed = true;

    if (nextStatus === WHATSAPP_SEND_STATUSES.DELIVERED && !send.deliveredAt) {
      send.deliveredAt = eventAt;
    }
    if (nextStatus === WHATSAPP_SEND_STATUSES.READ) {
      if (!send.deliveredAt) send.deliveredAt = eventAt;
      send.readAt = eventAt;
    }
    if (nextStatus === WHATSAPP_SEND_STATUSES.FAILED) {
      send.failedAt = eventAt;
      const errorMessage = pickFirstString(
        body.reason,
        body.error,
        body.errorMessage,
        body.message,
        body.failureReason,
        body.failure_reason,
      );
      if (errorMessage) {
        send.errorMessage = errorMessage.slice(0, 500);
      }

      const { code, category } = classifyFailureText(send.errorMessage);
      send.failureCode = code;
      send.failureCategory = category;

      if (category === WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT) {
        await whatsappSuppressionRepository.upsertSuppression({
          phone: send.phone,
          reason: 'opted_out',
          sourceSendId: send._id,
          failureCode: code,
        });
        send.retryState = 'suppressed';
        send.nextRetryAt = null;
      } else {
        const delayMs = nextRetryDelayMs(category, send.retryCount || 0);
        if (delayMs != null) {
          send.retryState = 'scheduled';
          send.nextRetryAt = new Date(eventAt.getTime() + delayMs);
        } else {
          send.retryState = 'exhausted';
          send.nextRetryAt = null;
        }
      }
    }
  }

  const deliveredAt = parseWebhookTimestamp(
    body.delivered_at,
    body.deliveredAt,
    body.deliveryTime,
  );
  const readAt = parseWebhookTimestamp(
    body.read_at,
    body.readAt,
    body.readTime,
  );
  if (deliveredAt && !send.deliveredAt) {
    send.deliveredAt = deliveredAt;
    changed = true;
    if (canAdvanceStatus(send.status, WHATSAPP_SEND_STATUSES.DELIVERED)) {
      send.status = WHATSAPP_SEND_STATUSES.DELIVERED;
      send.statusUpdatedAt = deliveredAt;
    }
  }
  if (readAt) {
    if (!send.readAt) send.readAt = readAt;
    if (!send.deliveredAt) send.deliveredAt = readAt;
    if (canAdvanceStatus(send.status, WHATSAPP_SEND_STATUSES.READ)) {
      send.status = WHATSAPP_SEND_STATUSES.READ;
      send.statusUpdatedAt = readAt;
    }
    changed = true;
  }

  if (changed) {
    await whatsappSendsRepository.saveWhatsAppSend(send);
  }

  return {
    matched: true,
    changed,
    send: toWhatsAppSendDto(send),
  };
};

export const assertWebhookAuthorized = (req) => {
  const secret = config.msg91.webhookSecret || '';
  if (!secret) {
    // Unconfigured = open endpoint (local / until MSG91 webhook secret is set).
    return true;
  }

  const provided =
    req.get('x-webhook-secret') ||
    req.get('x-msg91-secret') ||
    req.query?.token ||
    req.query?.secret ||
    '';

  return String(provided) === secret;
};

export const deleteWhatsAppSend = async (id) => {
  const send = await whatsappSendsRepository.findWhatsAppSendById(id);
  if (!send) {
    throw new AppError('WhatsApp send not found.', 404, {
      code: WHATSAPP_SENDS_CODES.SEND_NOT_FOUND,
    });
  }

  await whatsappSendsRepository.deleteWhatsAppSendById(id);

  await recordActivity({
    action: ACTIVITY_ACTIONS.WHATSAPP_SEND_DELETE,
    entityType: ENTITY_TYPES.WHATSAPP_SEND,
    entityId: id,
    changes: {
      phone: send.phone,
      clientCode: send.clientCode,
      period: send.period,
      status: send.status,
    },
  });
};

/**
 * Failure-code volume breakdown for the admin observability view — a spike
 * in quality_throttle (131048) needs a very different response than routine
 * long_backoff_retry (131049) or permanent_opt_out (131050) occurrences.
 */
export const getWhatsAppFailureSummary = async (query = {}) => {
  const { period, clientId, clientIds, locationId, locationIds, sinceDays } = query;

  const filter = await buildScopeFilter({
    period,
    clientId,
    clientIds,
    locationId,
    locationIds,
  });

  let since = null;
  if (sinceDays) {
    since = new Date();
    since.setDate(since.getDate() - Number(sinceDays));
  }

  const rows = await whatsappSendsRepository.aggregateFailuresByCategory(filter, since);
  return rows.map((row) => ({
    category: row._id || WHATSAPP_FAILURE_CATEGORIES.OTHER,
    count: row.count,
    lastSeenAt: row.lastSeenAt || null,
  }));
};

export const listSuppressedContacts = async ({ page, limit } = {}) => {
  const page_ = Math.max(1, Number(page) || 1);
  const limit_ = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (page_ - 1) * limit_;
  const [rows, total] = await Promise.all([
    whatsappSuppressionRepository.listSuppressions({ skip, limit: limit_ }),
    whatsappSuppressionRepository.countSuppressions(),
  ]);

  return {
    suppressions: rows.map((row) => ({
      id: String(row._id),
      phone: row.phone,
      reason: row.reason,
      failureCode: row.failureCode,
      notes: row.notes,
      suppressedAt: row.suppressedAt,
    })),
    pagination: {
      page: page_,
      limit: limit_,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit_)),
    },
  };
};

export const removeSuppression = async (id) => {
  const deleted = await whatsappSuppressionRepository.deleteSuppressionById(id);
  if (!deleted) {
    throw new AppError('Suppressed contact not found.', 404, {
      code: WHATSAPP_SENDS_CODES.SUPPRESSION_NOT_FOUND,
    });
  }

  await recordActivity({
    action: ACTIVITY_ACTIONS.WHATSAPP_SUPPRESSION_REMOVE,
    entityType: ENTITY_TYPES.WHATSAPP_SEND,
    entityId: id,
    changes: { phone: deleted.phone, reason: deleted.reason },
  });
};

/**
 * Classifies a caught send-time error for the 3 synchronous send call sites.
 * `userMessage` is null when the error isn't a recognized MSG91
 * delivery-restriction code — callers keep their own generic fallback then.
 */
export const classifySendError = (error) => {
  const raw = error?.message || null;
  const code = raw ? classifyFailureText(raw).code : null;
  if (!code) return { raw, code: null, category: null, userMessage: null };
  const { category } = classifyFailureText(raw);
  return { raw, code, category, userMessage: userFacingErrorMessage(raw) };
};

const logRowMatchesOpenSends = (row, { requestIds, providerIds, phones }) => {
  if (!row || typeof row !== 'object') return false;
  const { requestId, providerMessageId } = extractProviderIds(row);
  if (requestId && requestIds.has(requestId)) return true;
  if (providerMessageId && providerIds.has(providerMessageId)) return true;
  const phone = normalizePhoneDigits(
    pickFirstString(
      row.customerNumber,
      row.customer_number,
      row.phone,
      row.to,
      row.recipient,
    ),
  );
  return Boolean(phone && phones.has(phone));
};

/**
 * Pull MSG91 outbound logs for open sends and apply the same status rules
 * as the delivery webhook (covers missed callbacks).
 */
export const refreshWhatsAppSendStatuses = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const openSends = await whatsappSendsRepository.findOpenWhatsAppSendsSince(
    since,
    500,
  );

  const empty = {
    checked: openSends.length,
    logsFetched: 0,
    matched: 0,
    updated: 0,
    providerError: null,
  };

  if (openSends.length === 0 || !config.msg91.authKey) {
    return empty;
  }

  let logs = [];
  try {
    logs = await fetchWhatsAppOutboundLogs({
      startDate: openSends[0]?.sentAt || since,
      endDate: new Date(),
    });
  } catch (err) {
    logger.warn('[whatsappSends] Status refresh could not fetch MSG91 logs', {
      error: err.message,
    });
    return {
      ...empty,
      providerError: err.message || 'MSG91 logs unavailable',
    };
  }

  const requestIds = new Set(
    openSends.map((row) => row.requestId).filter(Boolean),
  );
  const providerIds = new Set(
    openSends.map((row) => row.providerMessageId).filter(Boolean),
  );
  const phones = new Set(
    openSends.map((row) => normalizePhoneDigits(row.phone)).filter(Boolean),
  );

  const matching = logs.filter((row) =>
    logRowMatchesOpenSends(row, { requestIds, providerIds, phones }),
  );
  const toApply = (matching.length > 0 ? matching : logs).slice(0, 1000);

  let matched = 0;
  let updated = 0;
  for (const row of toApply) {
    const result = await applyWhatsAppStatusWebhook(row, { quiet: true });
    if (result.matched) matched += 1;
    if (result.changed) updated += 1;
  }

  await recordActivity({
    action: ACTIVITY_ACTIONS.WHATSAPP_SEND_REFRESH,
    entityType: ENTITY_TYPES.WHATSAPP_SEND,
    changes: {
      checked: openSends.length,
      logsFetched: logs.length,
      matched,
      updated,
    },
  });

  return {
    checked: openSends.length,
    logsFetched: logs.length,
    matched,
    updated,
    providerError: null,
  };
};
