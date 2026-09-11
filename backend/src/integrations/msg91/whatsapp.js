import config from '../../config/index.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';

/**
 * Send a WhatsApp template message with a document header via MSG91 bulk API.
 *
 * @param {{
 *   phone: string,
 *   filename: string,
 *   mediaUrl: string,
 *   recipientName: string,
 *   monthName: string,
 *   year: string,
 * }} params
 */
export const sendForm5WhatsAppTemplate = async ({
  phone,
  filename,
  mediaUrl,
  recipientName,
  monthName,
  year,
}) => {
  const {
    authKey,
    integratedNumber,
    templateName,
    templateNamespace,
    templateLanguage,
    apiUrl,
  } = config.msg91;

  if (!authKey) {
    throw new AppError('MSG91 WhatsApp is not configured (MSG91_AUTH_KEY).', 503, {
      code: 'MSG91_NOT_CONFIGURED',
    });
  }

  const body = {
    integrated_number: integratedNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
          policy: 'deterministic',
        },
        namespace: templateNamespace,
        to_and_components: [
          {
            to: [phone],
            components: {
              header_1: {
                filename,
                type: 'document',
                value: mediaUrl,
              },
              body_1: {
                type: 'text',
                value: recipientName || '',
              },
              body_2: {
                type: 'text',
                value: monthName || '',
              },
              body_3: {
                type: 'text',
                value: year || '',
              },
            },
          },
        ],
      },
    },
  };

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    logger.error('[msg91] WhatsApp request failed', { error: error.message });
    throw new AppError('Could not reach MSG91 WhatsApp API.', 502, {
      code: 'MSG91_REQUEST_FAILED',
    });
  }

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { raw: rawText };
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      payload?.errors?.[0]?.message ||
      `MSG91 WhatsApp send failed (${response.status})`;
    logger.warn('[msg91] WhatsApp send rejected', {
      status: response.status,
      payload,
    });
    throw new AppError(String(message), 502, {
      code: 'MSG91_SEND_FAILED',
    });
  }

  return payload;
};

const DEFAULT_LOGS_API_URL =
  'https://control.msg91.com/api/v5/report/logs/wa';
/** Broken Flask path used in older env samples — remap to the official GET API. */
const LEGACY_LOGS_PATH = /\/whatsapp\/whatsapp-logs\/?$/i;
const LOGS_MAX_RANGE_DAYS = 3;
const LOGS_PAGE_LIMIT = 1000;
const LOGS_MAX_PAGES = 10;
const LOGS_FIELDS = [
  'requestedAt',
  'requestId',
  'status',
  'uuid',
  'integratedNumber',
  'customerNumber',
  'messageType',
  'direction',
  'failureReason',
  'sentTime',
  'deliveryTime',
  'readTime',
  'templateName',
].join(',');

const extractLogRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [
    payload.data,
    payload.logs,
    payload.result,
    payload.data?.data,
    payload.data?.logs,
    payload.data?.result,
  ];
  for (const rows of candidates) {
    if (Array.isArray(rows)) return rows;
  }
  return [];
};

const extractLogsError = (payload, { ok, status }) => {
  const fallback = `MSG91 WhatsApp logs failed (${status})`;
  if (!payload || typeof payload !== 'object') {
    return ok ? null : fallback;
  }

  const nestedError =
    payload.data &&
    typeof payload.data === 'object' &&
    !Array.isArray(payload.data)
      ? payload.data.error
      : null;
  const businessError =
    payload.error ||
    nestedError ||
    (payload.hasError
      ? payload.errors || payload.message || fallback
      : null);
  if (businessError) return String(businessError);
  if (ok) return null;

  return String(
    payload.message ||
      payload.errors?.[0]?.message ||
      payload.errors ||
      fallback,
  );
};

const toDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
  const text = toDateOnly(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** MSG91 WhatsApp logs accept at most 3 inclusive calendar days. */
const clampLogsDateRange = (startDate, endDate) => {
  const end = parseDateOnly(endDate);
  const start = parseDateOnly(startDate);
  if (!start || !end) return { start: null, end: null };
  const latest = start > end ? start : end;
  const earliest = start > end ? end : start;
  const minStart = new Date(latest);
  minStart.setDate(minStart.getDate() - (LOGS_MAX_RANGE_DAYS - 1));
  const clampedStart = earliest < minStart ? minStart : earliest;
  return {
    start: toDateOnly(clampedStart),
    end: toDateOnly(latest),
  };
};

const resolveLogsApiUrl = (configured) => {
  if (!configured || LEGACY_LOGS_PATH.test(String(configured))) {
    return DEFAULT_LOGS_API_URL;
  }
  return configured;
};

const isOutboundLogRow = (row) => {
  if (!row || typeof row !== 'object') return false;
  const direction = row.direction;
  if (direction === 0 || direction === '0' || direction === 'inbound') {
    return false;
  }
  return true;
};

const requestWhatsAppLogsPage = async ({
  authKey,
  logsApiUrl,
  start,
  end,
  paginationToken,
}) => {
  const url = new URL(logsApiUrl);
  url.searchParams.set('startDate', start);
  url.searchParams.set('endDate', end);
  url.searchParams.set('limit', String(LOGS_PAGE_LIMIT));
  url.searchParams.set('fields', LOGS_FIELDS);
  if (paginationToken) {
    url.searchParams.set('paginationToken', paginationToken);
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authkey: authKey,
      },
    });
  } catch (error) {
    logger.error('[msg91] WhatsApp logs request failed', { error: error.message });
    throw new AppError('Could not reach MSG91 WhatsApp logs API.', 502, {
      code: 'MSG91_LOGS_REQUEST_FAILED',
    });
  }

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { raw: rawText };
  }

  const providerError = extractLogsError(payload, {
    ok: response.ok,
    status: response.status,
  });
  if (!response.ok || providerError) {
    logger.warn('[msg91] WhatsApp logs rejected', {
      status: response.status,
      error: providerError,
    });
    throw new AppError(
      String(providerError || `MSG91 WhatsApp logs failed (${response.status})`),
      502,
      { code: 'MSG91_LOGS_FAILED' },
    );
  }

  return payload;
};

/**
 * Pull outbound delivery logs from MSG91 for a date range (YYYY-MM-DD).
 * Official API is GET /api/v5/report/logs/wa with a max 3-day window.
 * Used to refresh statuses when webhooks were missed.
 */
export const fetchWhatsAppOutboundLogs = async ({ startDate, endDate }) => {
  const { authKey, logsApiUrl: configuredLogsUrl } = config.msg91;

  if (!authKey) {
    throw new AppError('MSG91 WhatsApp is not configured (MSG91_AUTH_KEY).', 503, {
      code: 'MSG91_NOT_CONFIGURED',
    });
  }

  const { start, end } = clampLogsDateRange(startDate, endDate);
  if (!start || !end) {
    throw new AppError('Invalid WhatsApp logs date range.', 400, {
      code: 'MSG91_LOGS_INVALID_RANGE',
    });
  }

  const logsApiUrl = resolveLogsApiUrl(configuredLogsUrl);
  const rows = [];
  let paginationToken = null;

  for (let page = 0; page < LOGS_MAX_PAGES; page += 1) {
    const payload = await requestWhatsAppLogsPage({
      authKey,
      logsApiUrl,
      start,
      end,
      paginationToken,
    });
    const pageRows = extractLogRows(payload);
    rows.push(...pageRows);

    const total = Number(payload?.metadata?.total);
    const nextToken = payload?.metadata?.paginationToken || null;
    const gotAll =
      !nextToken ||
      pageRows.length === 0 ||
      (Number.isFinite(total) && rows.length >= total);
    if (gotAll) break;
    paginationToken = nextToken;
  }

  return rows.filter(isOutboundLogRow);
};
