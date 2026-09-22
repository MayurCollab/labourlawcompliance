export const CLIENTS_CODES = Object.freeze({
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_CODE_IN_USE: 'CLIENT_CODE_IN_USE',
  WHATSAPP_PHONE_REQUIRED: 'WHATSAPP_PHONE_REQUIRED',
  WHATSAPP_PHONE_INVALID: 'WHATSAPP_PHONE_INVALID',
  WHATSAPP_MISSING_FIELDS: 'WHATSAPP_MISSING_FIELDS',
  WHATSAPP_TEMPLATE_REQUIRES_DOCUMENT: 'WHATSAPP_TEMPLATE_REQUIRES_DOCUMENT',
});

export const CLIENTS_MESSAGES = Object.freeze({
  CREATED: 'Client created successfully.',
  UPDATED: 'Client updated successfully.',
  DELETED: 'Client deleted successfully.',
  FETCHED: 'Clients fetched successfully.',
  WHATSAPP_SENT: 'WhatsApp message sent successfully.',
});

export const CLIENT_SORTABLE_FIELDS = Object.freeze([
  'clientCode',
  'companyName',
  'createdAt',
  'updatedAt',
]);

export const normalizeClientCode = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase();
