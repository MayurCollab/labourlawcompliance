export const TEMPLATES_CODES = Object.freeze({
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  FILE_REQUIRED: 'FILE_REQUIRED',
  INVALID_KIND: 'INVALID_KIND',
  CODE_IN_USE: 'CODE_IN_USE',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  NO_TEMPLATE: 'NO_TEMPLATE',
});

export const TEMPLATES_MESSAGES = Object.freeze({
  CREATED: 'Template uploaded successfully.',
  FETCHED: 'Templates fetched successfully.',
  UPDATED: 'Template updated successfully.',
  DELETED: 'Template deleted successfully.',
  ASSIGNED: 'Template assignment saved.',
  RESOLVED: 'Template resolved.',
});

export const TEMPLATE_KINDS = Object.freeze({
  EXCEL: 'excel',
  DOCX: 'docx',
  PDF: 'pdf',
  HTML: 'html',
});

export const ASSIGNMENT_SCOPES = Object.freeze({
  GLOBAL: 'global',
  LOCATION: 'location',
  CLIENT: 'client',
});

export const TEMPLATE_SORTABLE_FIELDS = Object.freeze([
  'name',
  'code',
  'createdAt',
  'updatedAt',
]);
