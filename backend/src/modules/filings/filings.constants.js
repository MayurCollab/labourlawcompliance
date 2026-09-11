export const FILINGS_CODES = Object.freeze({
  FILING_NOT_FOUND: 'FILING_NOT_FOUND',
  NO_SLABS: 'NO_SLABS',
  COMPUTE_REQUIRED: 'COMPUTE_REQUIRED',
  NO_TEMPLATE: 'NO_TEMPLATE',
  OUTPUT_NOT_FOUND: 'OUTPUT_NOT_FOUND',
  PDF_CONVERTER_MISSING: 'PDF_CONVERTER_MISSING',
  PDF_CONVERT_FAILED: 'PDF_CONVERT_FAILED',
  WHATSAPP_PHONE_REQUIRED: 'WHATSAPP_PHONE_REQUIRED',
  WHATSAPP_PHONE_INVALID: 'WHATSAPP_PHONE_INVALID',
  WHATSAPP_MEDIA_URL_MISSING: 'WHATSAPP_MEDIA_URL_MISSING',
  WHATSAPP_NOT_GENERATED: 'WHATSAPP_NOT_GENERATED',
});

export const FILINGS_MESSAGES = Object.freeze({
  FETCHED: 'Filings fetched successfully.',
  PT_MISMATCHES_FETCHED: 'P.Tax mismatches fetched successfully.',
  COMPUTED: 'PT slabs computed successfully.',
  GENERATED: 'Form 5 generated successfully.',
  BULK_GENERATED: 'Bulk Form 5 generate finished.',
  OVERRIDES_UPDATED: 'Filing generate overrides saved.',
  WHATSAPP_SENT: 'Form 5 sent on WhatsApp successfully.',
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
