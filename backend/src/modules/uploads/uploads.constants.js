export const UPLOADS_CODES = Object.freeze({
  UPLOAD_NOT_FOUND: 'UPLOAD_NOT_FOUND',
  FILE_REQUIRED: 'FILE_REQUIRED',
  INVALID_KIND: 'INVALID_KIND',
  INVALID_SHEET: 'INVALID_SHEET',
  MAPPING_INCOMPLETE: 'MAPPING_INCOMPLETE',
  PARSE_FAILED: 'PARSE_FAILED',
  PERIOD_REQUIRED: 'PERIOD_REQUIRED',
  IDENTITY_REQUIRED: 'IDENTITY_REQUIRED',
  NO_IMPORT_ERRORS: 'NO_IMPORT_ERRORS',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  PURGE_SCOPE_EMPTY: 'PURGE_SCOPE_EMPTY',
});

export const PURGE_CONFIRMATIONS = Object.freeze({
  MASTER: 'CLEAR MASTER',
  SALARY: 'CLEAR SALARY',
  CLIENT_MASTER: 'CLEAR ADDRESSES',
});

export const UPLOADS_MESSAGES = Object.freeze({
  CREATED: 'File uploaded and parsed successfully.',
  FETCHED: 'Uploads fetched successfully.',
  PREVIEWED: 'Sheet preview updated successfully.',
  ROWS: 'Sheet rows fetched successfully.',
  IMPORTED: 'Data saved to the database.',
  MASTER_PURGED: 'Master client and filing data cleared.',
  SALARY_PURGED: 'Salary employee data cleared for the selected scope.',
  CLIENT_MASTER_PURGED: 'Client address and RC fields cleared.',
});

export const UPLOAD_KINDS = Object.freeze({
  MASTER: 'master',
  SALARY: 'salary',
  CLIENT_MASTER: 'clientMaster',
});

export const UPLOAD_STATUSES = Object.freeze({
  UPLOADED: 'uploaded',
  PREVIEWED: 'previewed',
  IMPORTED: 'imported',
  FAILED: 'failed',
});

export const UPLOAD_SORTABLE_FIELDS = Object.freeze([
  'createdAt',
  'originalName',
  'status',
]);

export const EXCEL_EXTENSIONS = Object.freeze(['.xlsx', '.xlsm', '.xls']);
