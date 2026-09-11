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
});

export const WHATSAPP_SENDS_MESSAGES = Object.freeze({
  FETCHED: 'WhatsApp sends fetched successfully.',
  DELETED: 'WhatsApp send deleted successfully.',
  REFRESHED: 'WhatsApp send statuses refreshed.',
  WEBHOOK_OK: 'WhatsApp status webhook accepted.',
});
