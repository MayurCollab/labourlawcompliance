export const FILINGS_CODES = Object.freeze({
  FILING_NOT_FOUND: 'FILING_NOT_FOUND',
  NO_SLABS: 'NO_SLABS',
  COMPUTE_REQUIRED: 'COMPUTE_REQUIRED',
  NO_TEMPLATE: 'NO_TEMPLATE',
  OUTPUT_NOT_FOUND: 'OUTPUT_NOT_FOUND',
  PDF_CONVERTER_MISSING: 'PDF_CONVERTER_MISSING',
  PDF_CONVERT_FAILED: 'PDF_CONVERT_FAILED',
});

export const FILINGS_MESSAGES = Object.freeze({
  FETCHED: 'Filings fetched successfully.',
  COMPUTED: 'PT slabs computed successfully.',
  GENERATED: 'Form 5 generated successfully.',
  BULK_GENERATED: 'Bulk Form 5 generate finished.',
  OVERRIDES_UPDATED: 'Filing generate overrides saved.',
});

export const GENERATE_STATUSES = Object.freeze({
  PENDING: 'pending',
  GENERATED: 'generated',
  FAILED: 'failed',
});

export const FILING_SORTABLE_FIELDS = Object.freeze([
  'period',
  'clientCode',
  'createdAt',
  'updatedAt',
]);
