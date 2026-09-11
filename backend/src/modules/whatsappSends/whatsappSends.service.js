import config from '../../config/index.js';
import { fetchWhatsAppOutboundLogs } from '../../integrations/msg91/whatsapp.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';
import { getRequestContext } from '../../utils/requestContext.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import {
  WHATSAPP_SEND_STATUSES,
  WHATSAPP_SEND_STATUS_RANK,
  WHATSAPP_SENDS_CODES,
} from './whatsappSends.constants.js';
import { toWhatsAppSendDto, toWhatsAppSendListDto } from './whatsappSends.dto.js';
import * as whatsappSendsRepository from './whatsappSends.repository.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
      templateName: input.templateName ?? config.msg91.templateName ?? null,
      status: input.status || WHATSAPP_SEND_STATUSES.ACCEPTED,
      requestId: input.requestId ?? requestId,
      providerMessageId: input.providerMessageId ?? providerMessageId,
      errorMessage: input.errorMessage
        ? String(input.errorMessage).slice(0, 500)
        : null,
      providerResponse: summarizeProviderResponse(input.providerResponse),
      sentAt: input.sentAt || new Date(),
      deliveredAt: input.deliveredAt ?? null,
      readAt: input.readAt ?? null,
      failedAt:
        input.status === WHATSAPP_SEND_STATUSES.FAILED
          ? input.failedAt || new Date()
          : null,
      statusUpdatedAt: new Date(),
      actorId: input.actorId ?? ctx.userId ?? null,
      actorEmail: input.actorEmail ?? ctx.userEmail ?? null,
    };

    await whatsappSendsRepository.createWhatsAppSend(doc);
  } catch (err) {
    logger.error(
      `[whatsappSends] Failed to record send: ${err.message}`,
    );
  }
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

  const filter = {};

  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [
      { phone: regex },
      { clientCode: regex },
      { companyName: regex },
      { filename: regex },
      { requestId: regex },
      { providerMessageId: regex },
    ];
  }

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
