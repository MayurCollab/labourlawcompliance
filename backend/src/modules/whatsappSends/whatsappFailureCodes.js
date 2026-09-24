/**
 * Classification of MSG91/Meta WhatsApp outbound failure codes.
 * Different codes need different handling — see the failure code table in
 * the MSG91 + Meta docs. Never treat these uniformly.
 */

export const WHATSAPP_FAILURE_CATEGORIES = Object.freeze({
  /** 131050 — user opted out of marketing messages. Permanent, never retry. */
  PERMANENT_OPT_OUT: 'permanent_opt_out',
  /** 131049 — per-recipient adaptive marketing limit. Wait ≥24h, then longer. */
  LONG_BACKOFF_RETRY: 'long_backoff_retry',
  /** 131056 (pair rate limit) / 130429 (throughput limit). Short pacing issue. */
  SHORT_BACKOFF_RETRY: 'short_backoff_retry',
  /** 131048 — account/WABA-level quality throttle. Not fixed by retrying. */
  QUALITY_THROTTLE: 'quality_throttle',
  /** 131026 — recipient-side undeliverable (not on WhatsApp / stale client). */
  UNDELIVERABLE_FALLBACK: 'undeliverable_fallback',
  /** Unrecognized code — safest default is no auto-retry, flag for review. */
  OTHER: 'other',
});

const FAILURE_CODE_MAP = Object.freeze({
  131050: WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT,
  131049: WHATSAPP_FAILURE_CATEGORIES.LONG_BACKOFF_RETRY,
  131056: WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY,
  130429: WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY,
  131048: WHATSAPP_FAILURE_CATEGORIES.QUALITY_THROTTLE,
  131026: WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK,
});

/** Backoff sequences are in milliseconds, indexed by the retry attempt (0-based). */
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const RETRY_POLICY = Object.freeze({
  [WHATSAPP_FAILURE_CATEGORIES.LONG_BACKOFF_RETRY]: {
    backoffMs: [24 * HOUR_MS, 48 * HOUR_MS, 96 * HOUR_MS, 168 * HOUR_MS],
    maxAttempts: 4,
  },
  [WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY]: {
    backoffMs: [5 * MINUTE_MS, 15 * MINUTE_MS, 45 * MINUTE_MS],
    maxAttempts: 3,
  },
  [WHATSAPP_FAILURE_CATEGORIES.QUALITY_THROTTLE]: { backoffMs: [], maxAttempts: 0 },
  [WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT]: { backoffMs: [], maxAttempts: 0 },
  [WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK]: { backoffMs: [], maxAttempts: 0 },
  [WHATSAPP_FAILURE_CATEGORIES.OTHER]: { backoffMs: [], maxAttempts: 0 },
});

/** Pulls the leading numeric MSG91/Meta error code out of a reason/error string. */
export const parseFailureCode = (text) => {
  const match = String(text ?? '').match(/(\d{5,6})\s*:/);
  return match ? match[1] : null;
};

export const classifyFailureCode = (code) => {
  if (!code) return WHATSAPP_FAILURE_CATEGORIES.OTHER;
  return FAILURE_CODE_MAP[Number(code)] || WHATSAPP_FAILURE_CATEGORIES.OTHER;
};

/** Convenience: parse + classify a raw reason/error string in one call. */
export const classifyFailureText = (text) => {
  const code = parseFailureCode(text);
  return { code, category: classifyFailureCode(code) };
};

export const getRetryPolicy = (category) =>
  RETRY_POLICY[category] || RETRY_POLICY[WHATSAPP_FAILURE_CATEGORIES.OTHER];

/**
 * Next retry delay (ms) for a given category + 0-based attempt number, or
 * null when no further retry is allowed.
 */
export const nextRetryDelayMs = (category, attempt) => {
  const policy = getRetryPolicy(category);
  if (attempt >= policy.maxAttempts) return null;
  return policy.backoffMs[attempt] ?? policy.backoffMs[policy.backoffMs.length - 1] ?? null;
};

/** Small, closed set of plain statuses safe to show to normal (non-admin) users. */
export const USER_FACING_STATUSES = Object.freeze({
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  READ: 'read',
  RETRY_SCHEDULED: 'retry_scheduled',
  UNREACHABLE: 'unreachable',
  OPTED_OUT: 'opted_out',
  NEEDS_REVIEW: 'needs_review',
});

export const USER_FACING_STATUS_LABELS = Object.freeze({
  [USER_FACING_STATUSES.DELIVERING]: 'Delivering',
  [USER_FACING_STATUSES.DELIVERED]: 'Delivered',
  [USER_FACING_STATUSES.READ]: 'Read',
  [USER_FACING_STATUSES.RETRY_SCHEDULED]: "We'll retry shortly",
  [USER_FACING_STATUSES.UNREACHABLE]: "Couldn't reach this contact on WhatsApp",
  [USER_FACING_STATUSES.OPTED_OUT]: 'This contact has opted out',
  [USER_FACING_STATUSES.NEEDS_REVIEW]: 'Delivery issue — under review',
});

/**
 * Maps a ledger row's internal status/failureCategory/retryState to the
 * plain status normal users should see. Never exposes the raw code/text.
 */
export const toUserFacingStatus = ({ status, failureCategory, retryState }) => {
  if (status === 'read') return USER_FACING_STATUSES.READ;
  if (status === 'delivered') return USER_FACING_STATUSES.DELIVERED;
  if (status === 'accepted' || status === 'sent') {
    return USER_FACING_STATUSES.DELIVERING;
  }
  if (status !== 'failed') return USER_FACING_STATUSES.DELIVERING;

  if (failureCategory === WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT) {
    return USER_FACING_STATUSES.OPTED_OUT;
  }
  if (failureCategory === WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK) {
    return USER_FACING_STATUSES.UNREACHABLE;
  }
  if (retryState === 'scheduled') {
    return USER_FACING_STATUSES.RETRY_SCHEDULED;
  }
  return USER_FACING_STATUSES.NEEDS_REVIEW;
};

/** User-safe message to show at send time when a send is rejected synchronously. */
export const userFacingErrorMessage = (rawText) => {
  const { category } = classifyFailureText(rawText);
  switch (category) {
    case WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT:
      return 'This contact has opted out of WhatsApp messages and cannot be sent to.';
    case WHATSAPP_FAILURE_CATEGORIES.LONG_BACKOFF_RETRY:
      return "This contact has hit WhatsApp's messaging limit for now — we'll retry automatically over the next few days.";
    case WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY:
      return "WhatsApp is briefly rate-limiting this send — we'll retry automatically shortly.";
    case WHATSAPP_FAILURE_CATEGORIES.QUALITY_THROTTLE:
      return 'WhatsApp sending is temporarily throttled for this account. Please contact support before sending more messages.';
    case WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK:
      return "Couldn't reach this contact on WhatsApp. Please verify the number or use another channel.";
    default:
      return null;
  }
};
