import type { Client } from '@/types/client.types';
import type { Filing } from '@/types/filing.types';
import type {
  WhatsAppCustomValues,
  WhatsAppCustomVariable,
  WhatsAppGenericTemplateWrapper,
  WhatsAppSourceData,
  WhatsAppTemplateField,
  WhatsAppTemplateVariable,
} from '@/types/whatsappTemplate.types';

/**
 * Month names matching backend MONTH_NAMES constant
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Parse a period string (YYYY-MM) into month name and year.
 * Matches backend periodMonthAndYear utility.
 */
const parsePeriod = (period: string | null | undefined) => {
  const match = String(period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return { monthName: '', year: '' };
  const month = Number(match[2]);
  return {
    monthName: MONTH_NAMES[month - 1] || match[2],
    year: match[1],
  };
};

/**
 * Build source data from a filing row for template resolution.
 * Mirrors backend buildWhatsAppSourceData function.
 *
 * `signatoryNameOverride` should already be resolved through the same
 * override -> client -> org-default chain the Form 5 PDF itself uses (see
 * resolveSignatoryName in the backend's filings.service.js) — otherwise this
 * preview shows blank for any client that relies on the org-wide default,
 * even though the PDF being sent prints that default correctly.
 */
export const buildWhatsAppSourceData = (
  filing: Filing,
  recipientNameOverride?: string,
  signatoryNameOverride?: string,
): WhatsAppSourceData => {
  const { monthName, year } = parsePeriod(filing.period);

  const recipientName = String(
    recipientNameOverride ?? filing.client?.recipientName ?? '',
  ).trim();

  return {
    recipientName,
    companyName: String(filing.client?.companyName ?? '').trim(),
    clientCode: String(filing.clientCode ?? '').trim(),
    month: monthName,
    year,
    periodLabel: String(filing.periodLabel ?? '').trim(),
    signatoryName: String(
      signatoryNameOverride ?? filing.client?.signatoryName ?? '',
    ).trim(),
  };
};

/**
 * Short display label for a period, e.g. "Jul-2026". Mirrors the backend's
 * formatPeriodLabel (utils/period.js) — used when a period is picked ad hoc
 * here rather than read off an existing filing's own stored periodLabel.
 */
export const formatPeriodLabel = (period: string | null | undefined): string => {
  const { monthName, year } = parsePeriod(period);
  if (!monthName || !year) return '';
  return `${monthName.slice(0, 3)}-${year}`;
};

/**
 * Build source data from a client record for template resolution — used by
 * the Clients WhatsApp flow, which sends message templates directly against
 * a client with no generated document. There is no filing here, so
 * month/year/periodLabel are only populated when the operator picks a period
 * up front (only required when the template actually references one).
 */
export const buildWhatsAppSourceDataForClient = (
  client: Client,
  recipientNameOverride?: string,
  signatoryNameOverride?: string,
  period?: string,
): WhatsAppSourceData => {
  const { monthName, year } = parsePeriod(period);
  return {
    recipientName: String(
      recipientNameOverride ?? client.recipientName ?? '',
    ).trim(),
    companyName: String(client.companyName ?? '').trim(),
    clientCode: String(client.clientCode ?? '').trim(),
    month: monthName,
    year,
    periodLabel: formatPeriodLabel(period),
    signatoryName: String(
      signatoryNameOverride ?? client.signatoryName ?? '',
    ).trim(),
  };
};

/** Field keys only ever available from a period — never from a bare client record. */
const PERIOD_DEPENDENT_FIELDS: WhatsAppTemplateField['field'][] = [
  'month',
  'year',
  'periodLabel',
];

/**
 * Whether a template references month/year/periodLabel — the fields that
 * only come from a period, never from a client record alone. Drives whether
 * the Clients send modal needs to ask for a period before sending.
 */
export const templateUsesPeriodFields = (
  variables: WhatsAppTemplateVariable[] | undefined,
): boolean =>
  (variables ?? []).some(
    (variable) =>
      variable.type === 'field' &&
      PERIOD_DEPENDENT_FIELDS.includes(variable.field),
  );

/** Custom variables on a template, in body order. */
export const collectCustomVariables = (
  variables: WhatsAppTemplateVariable[] | undefined,
): WhatsAppCustomVariable[] =>
  (variables ?? []).filter(
    (variable): variable is WhatsAppCustomVariable =>
      variable.type === 'custom',
  );

/** Our own naming convention for a custom-text placeholder — see `deriveTemplateVariables`. */
const CUSTOM_TOKEN_PATTERN = /\{\{CustomText\d+\}\}/g;

/**
 * Next free `{{CustomTextN}}` placeholder, so inserting a second custom
 * variable does not collide with one already in the body text.
 */
export const nextCustomToken = (bodyPreview: string): string => {
  const taken = new Set(bodyPreview.match(CUSTOM_TOKEN_PATTERN) ?? []);
  let n = 1;
  while (taken.has(`{{CustomText${n}}}`)) n += 1;
  return `{{CustomText${n}}}`;
};

/**
 * A `bodyMode: 'single'` template's whole composed message becomes one MSG91
 * variable, and MSG91 rejects any variable value containing a line break —
 * the backend collapses them to spaces before sending. Applying the same
 * collapse to the preview keeps it honest: what's shown while composing is
 * what actually gets delivered, not a multi-line version the recipient will
 * never see. Only meaningful for 'single' mode — a 'positional' template's
 * bodyPreview is reference text only and is never sent verbatim.
 */
export const collapseWhatsAppBodyLineBreaks = (text: string): string =>
  text.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resolve a template's bodyPreview by substituting tokens with source data values.
 * Used for live preview in editor and send modals.
 *
 * Only the substituted value is wrapped `*like this*` (WhatsApp's own bold
 * syntax) — literal wording the operator typed around it stays plain, matching
 * what the backend actually sends (see resolveWhatsAppMessage). Use
 * `splitWhatsAppBoldSegments` to render this text with real bold styling.
 * Custom variables show the typed text, or a bracketed (unbolded) hint while
 * empty — wording fixed inside the approved template passes through untouched.
 */
/**
 * Removing an empty variable (e.g. a blank recipient name) can leave the
 * surrounding literal text with an orphan space before punctuation, or a run
 * of double spaces where the value used to sit — "Hii , Please" instead of
 * "Hii, Please". Tidy that up after substitution so a skipped token never
 * reads as a typo. Only touches spaces/tabs, never line breaks. Mirrors the
 * backend's cleanupResolvedText (whatsappTemplates.resolve.js).
 */
const cleanupWhatsAppPreviewText = (text: string): string =>
  text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .trim();

export const resolveWhatsAppPreview = (
  bodyPreview: string,
  fields: WhatsAppTemplateField[],
  sourceData: WhatsAppSourceData,
  customVariables: WhatsAppCustomVariable[] = [],
  customValues: WhatsAppCustomValues = {},
): string => {
  let resolved = bodyPreview;

  for (const field of fields) {
    const value = sourceData[field.field] || '';
    // Replace all occurrences of the token with the value
    resolved = resolved.split(field.token).join(value ? `*${value}*` : '');
  }

  for (const variable of customVariables) {
    const typed = (customValues[variable.token] ?? '').trim();
    const shown = typed ? `*${typed}*` : `[${variable.label || 'Custom text'}]`;
    resolved = resolved.split(variable.token).join(shown);
  }

  return cleanupWhatsAppPreviewText(resolved);
};

/**
 * The full message a 'single' mode template's recipient actually sees. MSG91
 * wraps the composed body with fixed wording on its own side — that wording
 * is never sent by us (see backend config.msg91.genericTemplate), only shown
 * here so the preview doesn't let an operator duplicate it by typing
 * "Hii"/"Thank you" themselves. Meaningless for 'positional' templates,
 * which have no separate wrapper concept.
 *
 * MSG91's approved wrapper is literally "Hii {1},\n\nThank you" — its suffix
 * already starts with a comma. If the operator's own body also ends in one
 * (e.g. "...as requested,"), the recipient sees it doubled: "...requested,,".
 * Trim one trailing comma so the preview matches what's actually sent — see
 * the matching trim on the backend (whatsappTemplates.resolve.js).
 */
export const wrapWithGenericTemplate = (
  body: string,
  wrapper: WhatsAppGenericTemplateWrapper,
): string => {
  const trimmedBody = /^\s*,/.test(wrapper.suffix)
    ? body.replace(/,\s*$/, '')
    : body;
  return `${wrapper.prefix} ${trimmedBody}${wrapper.suffix}`;
};

export type WhatsAppPreviewSegment = { text: string; bold: boolean };

/**
 * Splits `*bold*` markers (WhatsApp's own bold syntax, applied by
 * resolveWhatsAppPreview / resolveWhatsAppMessage) into renderable segments,
 * so the preview can show real bold instead of literal asterisks.
 */
export const splitWhatsAppBoldSegments = (
  text: string,
): WhatsAppPreviewSegment[] => {
  const segments: WhatsAppPreviewSegment[] = [];
  const pattern = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments;
};

/**
 * The editor's `variables` list is not a separately managed thing anymore —
 * it is derived, on every keystroke, from what's actually written in the
 * body: known field tokens, plus any `{{CustomTextN}}`-shaped token (our own
 * naming convention, recognized by pattern rather than a registry). This
 * means "remove a variable" is just deleting its token from the text, and
 * reordering tokens in the text is what reorders body_N slots — no separate
 * mapping list to keep in sync or go stale.
 *
 * `customLabels` (keyed by token) supplies each custom variable's admin-facing
 * label, since that can't be read back from the token itself.
 */
export const deriveTemplateVariables = (
  bodyPreview: string,
  fields: WhatsAppTemplateField[],
  customLabels: Record<string, string> = {},
): WhatsAppTemplateVariable[] => {
  const seen: Set<string> = new Set();
  const found: Array<{ variable: WhatsAppTemplateVariable; pos: number }> = [];

  for (const field of fields) {
    const pos = bodyPreview.indexOf(field.token);
    if (pos !== -1 && !seen.has(field.token)) {
      found.push({ variable: { type: 'field', field: field.field }, pos });
      seen.add(field.token);
    }
  }

  for (const match of bodyPreview.matchAll(CUSTOM_TOKEN_PATTERN)) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);
    found.push({
      variable: { type: 'custom', token, label: customLabels[token] ?? '' },
      pos: match.index ?? 0,
    });
  }

  found.sort((a, b) => a.pos - b.pos);

  return found.map((item) => item.variable);
};

/**
 * Get missing field labels for error messages
 */
export const getMissingFieldLabels = (
  missingFields: string[],
  fields: WhatsAppTemplateField[],
): string[] => {
  return missingFields.map((fieldKey) => {
    const field = fields.find((f) => f.field === fieldKey);
    return field?.label ?? fieldKey;
  });
};
