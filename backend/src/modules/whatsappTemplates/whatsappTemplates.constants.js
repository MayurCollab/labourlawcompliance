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
    sample: 'Mr. Dipen Shah',
    // Optional — a send is never blocked on this being empty; the token is
    // just cleaned out of the message text instead (see resolveWhatsAppMessage).
    optional: true,
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

/**
 * How a variable gets its value.
 * - `field`: read from client / filing data (the only kind before custom text existed,
 *   and the default so stored templates without a `type` keep resolving as fields).
 * - `custom`: free text the operator types at send time. It fills a body slot the
 *   provider already approved — it never changes the approved template itself.
 */
export const WHATSAPP_VARIABLE_TYPES = Object.freeze({
  FIELD: 'field',
  CUSTOM: 'custom',
});

export const WHATSAPP_VARIABLE_TYPE_VALUES = /** @type {[string, ...string[]]} */ ([
  WHATSAPP_VARIABLE_TYPES.FIELD,
  WHATSAPP_VARIABLE_TYPES.CUSTOM,
]);

/** Placeholder written in the body for a custom variable, e.g. `{{CustomText1}}`. */
export const CUSTOM_TOKEN_REGEX = /^\{\{[A-Za-z0-9_]+\}\}$/;

/**
 * How a template's variables reach MSG91.
 * - `positional`: each variable is its own body_N value (Template 1's 3-variable
 *   shape). Default, so templates stored before this existed keep resolving
 *   exactly as they did.
 * - `single`: the entire resolved body text — every token substituted, literal
 *   wording kept as-is — becomes the one value MSG91 receives. Used by every
 *   template created through the app now, since the only other approved
 *   template has just one variable slot.
 */
export const WHATSAPP_BODY_MODES = Object.freeze({
  POSITIONAL: 'positional',
  SINGLE: 'single',
});

export const WHATSAPP_BODY_MODE_VALUES = /** @type {[string, ...string[]]} */ ([
  WHATSAPP_BODY_MODES.POSITIONAL,
  WHATSAPP_BODY_MODES.SINGLE,
]);

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
  CUSTOM_VALUE_MISSING: 'WHATSAPP_TEMPLATE_CUSTOM_VALUE_MISSING',
  GENERIC_TEMPLATE_NOT_CONFIGURED: 'WHATSAPP_GENERIC_TEMPLATE_NOT_CONFIGURED',
});

export const WHATSAPP_TEMPLATES_MESSAGES = Object.freeze({
  CREATED: 'WhatsApp template created successfully.',
  UPDATED: 'WhatsApp template updated successfully.',
  DELETED: 'WhatsApp template deleted successfully.',
  FETCHED: 'WhatsApp templates fetched successfully.',
  FIELDS_FETCHED: 'WhatsApp template fields fetched successfully.',
});
