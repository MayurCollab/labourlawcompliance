import { periodMonthAndYear } from '../../utils/period.js';
import { toWhatsAppBold } from '../../integrations/msg91/whatsapp.js';
import {
  WHATSAPP_BODY_MODES,
  WHATSAPP_TEMPLATE_FIELDS,
  WHATSAPP_VARIABLE_TYPES,
} from './whatsappTemplates.constants.js';

const text = (value) => String(value ?? '').trim();

const isCustom = (variable) => variable?.type === WHATSAPP_VARIABLE_TYPES.CUSTOM;

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

/** Custom variables on a template, in body order, each with its slot index. */
export const listCustomVariables = (template) =>
  (template?.variables || [])
    .map((variable, index) => ({ variable, index }))
    .filter(({ variable }) => isCustom(variable))
    .map(({ variable, index }) => ({
      index,
      token: variable.token,
      label: variable.label,
    }));

/**
 * Value the operator typed for a custom variable. Keyed by the placeholder
 * token so it survives reordering; the positional index is a fallback for
 * callers that only know the slot.
 */
const customValueFor = (variable, index, customValues) =>
  text(customValues?.[variable.token] ?? customValues?.[String(index)]);

/**
 * Names the missing values so the error tells the operator what to fill in.
 * Custom variables report their label, data fields their field label.
 */
const missingLabelFor = (variable) =>
  isCustom(variable)
    ? variable.label || 'Custom text'
    : (WHATSAPP_TEMPLATE_FIELDS.find((item) => item.field === variable.field)?.label ??
      variable.field);

/**
 * Resolve a template against source data.
 * - `customValues`: text typed at send time, keyed by custom token (or slot index).
 * - `bodyValues`: the value(s) actually sent to MSG91 — see `bodyMode` below.
 *   Only the substituted variable text is bold (`*value*`) — literal wording
 *   the operator typed directly is left plain.
 * - `missing`: labels of variables with no value (WhatsApp rejects empty parameters).
 * - `previewText`: `bodyPreview` with known tokens substituted (display only,
 *   same bolding as `bodyValues`) — wording fixed inside the approved
 *   template passes through untouched.
 *
 * `template.bodyMode` decides how `bodyValues` is built:
 * - 'positional' (default — Template 1's 3-variable shape): one entry per
 *   variable, in array order, matching MSG91's body_1..body_N. Each entry is
 *   the whole variable value, bolded.
 * - 'single' (every template created through the app now, since the only
 *   other approved template has one variable slot): the whole resolved
 *   `previewText` becomes the sole entry — whatever the operator composed,
 *   fields and custom text alike, collapses into that one slot's value, with
 *   only the substituted parts bolded.
 */
export const resolveWhatsAppMessage = (template, sourceData, customValues = {}) => {
  const missing = [];

  (template.variables || []).forEach((variable, index) => {
    const value = isCustom(variable)
      ? customValueFor(variable, index, customValues)
      : text(sourceData?.[variable.field]);

    if (!value) {
      const label = missingLabelFor(variable);
      if (!missing.includes(label)) missing.push(label);
    }
  });

  // Substitute with bold markers — this is what both previewText and, for
  // 'single' mode, the sent body value are built from. Literal text the
  // operator typed around the tokens is never touched, so it stays plain.
  let previewText = template.bodyPreview || '';
  for (const definition of WHATSAPP_TEMPLATE_FIELDS) {
    const value = text(sourceData?.[definition.field]);
    previewText = previewText.split(definition.token).join(toWhatsAppBold(value));
  }
  (template.variables || []).forEach((variable, index) => {
    if (!isCustom(variable)) return;
    const value = customValueFor(variable, index, customValues);
    if (value) {
      previewText = previewText.split(variable.token).join(toWhatsAppBold(value));
    }
  });

  const bodyValues =
    template.bodyMode === WHATSAPP_BODY_MODES.SINGLE
      ? [previewText]
      : (template.variables || []).map((variable, index) =>
          toWhatsAppBold(
            isCustom(variable)
              ? customValueFor(variable, index, customValues)
              : text(sourceData?.[variable.field]),
          ),
        );

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
  bodyMode: template.bodyMode || WHATSAPP_BODY_MODES.POSITIONAL,
  variables: (template.variables || []).map((item) =>
    isCustom(item)
      ? {
          type: WHATSAPP_VARIABLE_TYPES.CUSTOM,
          label: item.label,
          token: item.token,
        }
      : { type: WHATSAPP_VARIABLE_TYPES.FIELD, field: item.field },
  ),
});

/** `missing` already holds display labels — see `missingLabelFor`. */
export const missingFieldsMessage = (missing) =>
  `Missing value for: ${missing.join(', ')}`;

/**
 * Custom values are chosen once per send, not per recipient, so a bulk send
 * checks them up front instead of skipping every row with the same error.
 * Returns the labels with no value.
 */
export const missingCustomValues = (template, customValues = {}) =>
  listCustomVariables(template)
    .filter(({ token, index }) => !text(customValues?.[token] ?? customValues?.[String(index)]))
    .map(({ label }) => label || 'Custom text');
