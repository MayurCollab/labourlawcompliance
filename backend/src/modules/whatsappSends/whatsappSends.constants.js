import { WHATSAPP_FAILURE_CATEGORIES } from './whatsappFailureCodes.js';

export const WHATSAPP_SEND_STATUSES = Object.freeze({
  ACCEPTED: 'accepted',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
});

/** Rank used so webhook updates never move status backwards. */
export const WHATSAPP_SEND_STATUS_RANK = Object.freeze({
  [WHATSAPP_SEND_STATUSES.ACCEPTED]: 1,
  [WHATSAPP_SEND_STATUSES.SENT]: 2,
  [WHATSAPP_SEND_STATUSES.DELIVERED]: 3,
  [WHATSAPP_SEND_STATUSES.READ]: 4,
  [WHATSAPP_SEND_STATUSES.FAILED]: 5,
});

export const WHATSAPP_SEND_STATUS_VALUES = /** @type {[string, ...string[]]} */ (
  Object.values(WHATSAPP_SEND_STATUSES)
);

/** Lifecycle of a send's auto-retry, independent of `status`. */
export const WHATSAPP_RETRY_STATES = Object.freeze({
  NONE: 'none',
  SCHEDULED: 'scheduled',
  EXHAUSTED: 'exhausted',
  SUPPRESSED: 'suppressed',
});

export const WHATSAPP_RETRY_STATE_VALUES = /** @type {[string, ...string[]]} */ (
  Object.values(WHATSAPP_RETRY_STATES)
);

export const WHATSAPP_FAILURE_CATEGORY_VALUES = Object.values(
  WHATSAPP_FAILURE_CATEGORIES,
);

export const WHATSAPP_SEND_SORTABLE_FIELDS = Object.freeze([
  'sentAt',
  'status',
  'phone',
  'period',
  'clientCode',
  'createdAt',
  'updatedAt',
]);

export const WHATSAPP_SENDS_CODES = Object.freeze({
  SEND_NOT_FOUND: 'WHATSAPP_SEND_NOT_FOUND',
  WEBHOOK_UNAUTHORIZED: 'WHATSAPP_WEBHOOK_UNAUTHORIZED',
  RECIPIENT_SUPPRESSED: 'WHATSAPP_RECIPIENT_SUPPRESSED',
  RECENTLY_SENT: 'WHATSAPP_RECENTLY_SENT',
  SUPPRESSION_NOT_FOUND: 'WHATSAPP_SUPPRESSION_NOT_FOUND',
});

export const WHATSAPP_SENDS_MESSAGES = Object.freeze({
  FETCHED: 'WhatsApp sends fetched successfully.',
  DELETED: 'WhatsApp send deleted successfully.',
  REFRESHED: 'WhatsApp send statuses refreshed.',
  WEBHOOK_OK: 'WhatsApp status webhook accepted.',
  FAILURE_SUMMARY_FETCHED: 'WhatsApp failure summary fetched successfully.',
  SUPPRESSIONS_FETCHED: 'Suppressed WhatsApp contacts fetched successfully.',
  SUPPRESSION_REMOVED: 'Contact removed from the WhatsApp suppression list.',
});
