export const CLIENTS_CODES = Object.freeze({
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_CODE_IN_USE: 'CLIENT_CODE_IN_USE',
});

export const CLIENTS_MESSAGES = Object.freeze({
  CREATED: 'Client created successfully.',
  UPDATED: 'Client updated successfully.',
  DELETED: 'Client deleted successfully.',
  FETCHED: 'Clients fetched successfully.',
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
