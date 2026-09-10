import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { getRequestContext } from '../../utils/requestContext.js';
import {
  WHATSAPP_SEND_STATUSES,
  WHATSAPP_SEND_STATUS_RANK,
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
  if (value === 'failed' || value === 'failure' || value === 'undelivered') {
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
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const ms = value < 1e12 ? value * 1000 : value;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date;
    }
    const text = String(value).trim();
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
  if (clients.length === 1) filter.client = clients[0];
  else if (clients.length > 1) filter.client = { $in: clients };

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
 */
export const applyWhatsAppStatusWebhook = async (rawBody) => {
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
    logger.info('[whatsappSends] Webhook with no matching send', {
      requestId,
      providerMessageId,
      phone,
      eventName,
    });
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
        body.failure_reason,
      );
      if (errorMessage) {
        send.errorMessage = errorMessage.slice(0, 500);
      }
    }
  } else {
    // Still stamp timestamps if webhook carries them without a status upgrade.
    const deliveredAt = parseWebhookTimestamp(
      body.delivered_at,
      body.deliveredAt,
    );
    const readAt = parseWebhookTimestamp(body.read_at, body.readAt);
    if (deliveredAt && !send.deliveredAt) {
      send.deliveredAt = deliveredAt;
      changed = true;
    }
    if (readAt && !send.readAt) {
      send.readAt = readAt;
      if (!send.deliveredAt) send.deliveredAt = readAt;
      if (canAdvanceStatus(send.status, WHATSAPP_SEND_STATUSES.READ)) {
        send.status = WHATSAPP_SEND_STATUSES.READ;
        send.statusUpdatedAt = readAt;
      }
      changed = true;
    }
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
