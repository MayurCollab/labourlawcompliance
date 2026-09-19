/**
 * Data fields a WhatsApp template variable can be mapped to. `token` is the
 * placeholder written in the free-text body preview; `sample` is only used for
 * the editor's live preview.
 */
export const WHATSAPP_TEMPLATE_FIELDS = Object.freeze([
  {
    field: 'recipientName',
    token: '{{RecipientName}}',
    label: 'Recipient name',
    sample: 'Mr. Sharma',
  },
  {
    field: 'companyName',
    token: '{{ClientName}}',
    label: 'Client / company name',
    sample: 'Acer India Pvt. Ltd.',
  },
  {
    field: 'clientCode',
    token: '{{ClientCode}}',
    label: 'Client code',
    sample: 'C0001',
  },
  {
    field: 'month',
    token: '{{MonthOfForm5}}',
    label: 'Month of Form 5 (e.g. July)',
    sample: 'July',
  },
  {
    field: 'year',
    token: '{{Year}}',
    label: 'Year of Form 5 (e.g. 2026)',
    sample: '2026',
  },
  {
    field: 'periodLabel',
    token: '{{Period}}',
    label: 'Period label (e.g. Jul-2026)',
    sample: 'Jul-2026',
  },
  {
    field: 'signatoryName',
    token: '{{SignatoryName}}',
    label: 'Signatory name',
    sample: 'Authorized Signatory',
  },
]);

export const WHATSAPP_TEMPLATE_FIELD_KEYS = /** @type {[string, ...string[]]} */ (
  WHATSAPP_TEMPLATE_FIELDS.map((item) => item.field)
);

export const WHATSAPP_TEMPLATE_SORTABLE_FIELDS = Object.freeze([
  'label',
  'msg91TemplateName',
  'isActive',
  'createdAt',
  'updatedAt',
]);

export const WHATSAPP_TEMPLATES_CODES = Object.freeze({
  TEMPLATE_NOT_FOUND: 'WHATSAPP_TEMPLATE_NOT_FOUND',
  TEMPLATE_INACTIVE: 'WHATSAPP_TEMPLATE_INACTIVE',
  TEMPLATE_FIELD_MISSING: 'WHATSAPP_TEMPLATE_FIELD_MISSING',
});

export const WHATSAPP_TEMPLATES_MESSAGES = Object.freeze({
  CREATED: 'WhatsApp template created successfully.',
  UPDATED: 'WhatsApp template updated successfully.',
  DELETED: 'WhatsApp template deleted successfully.',
  FETCHED: 'WhatsApp templates fetched successfully.',
  FIELDS_FETCHED: 'WhatsApp template fields fetched successfully.',
});
