import { periodMonthAndYear } from '../../utils/period.js';
import { WHATSAPP_TEMPLATE_FIELDS } from './whatsappTemplates.constants.js';

const text = (value) => String(value ?? '').trim();

/**
 * Map a client + filing period to the values a template variable can pull from.
 * `recipientName` overrides the client's stored name (the send flows let the
 * user type a name that is not yet saved).
 */
export const buildWhatsAppSourceData = ({
  client,
  clientCode,
  period,
  periodLabel,
  recipientName,
}) => {
  const { monthName, year } = periodMonthAndYear(period);
  return {
    recipientName: text(recipientName ?? client?.recipientName),
    companyName: text(client?.companyName),
    clientCode: text(clientCode ?? client?.clientCode),
    month: monthName,
    year,
    periodLabel: text(periodLabel),
    signatoryName: text(client?.signatoryName),
  };
};

/**
 * Resolve a template against source data.
 * - `bodyValues`: ordered values for body_1..body_N (from `variables`).
 * - `missing`: fields whose value is empty (WhatsApp rejects empty parameters).
 * - `previewText`: `bodyPreview` with known {{Tokens}} substituted (display only).
 */
export const resolveWhatsAppMessage = (template, sourceData) => {
  const bodyValues = [];
  const missing = [];

  for (const variable of template.variables || []) {
    const value = text(sourceData?.[variable.field]);
    if (!value && !missing.includes(variable.field)) missing.push(variable.field);
    bodyValues.push(value);
  }

  let previewText = template.bodyPreview || '';
  for (const definition of WHATSAPP_TEMPLATE_FIELDS) {
    previewText = previewText
      .split(definition.token)
      .join(text(sourceData?.[definition.field]));
  }

  return { bodyValues, missing, previewText };
};

/** Frozen copy stored on each send so later template edits never rewrite history. */
export const toTemplateSnapshot = (template) => ({
  id: String(template.id ?? template._id),
  label: template.label,
  msg91TemplateName: template.msg91TemplateName,
  namespace: template.namespace,
  languageCode: template.languageCode,
  bodyPreview: template.bodyPreview ?? '',
  variables: (template.variables || []).map((item) => ({ field: item.field })),
});

export const missingFieldsMessage = (missing) => {
  const labels = missing.map(
    (field) =>
      WHATSAPP_TEMPLATE_FIELDS.find((item) => item.field === field)?.label ??
      field,
  );
  return `Missing value for: ${labels.join(', ')}`;
};
