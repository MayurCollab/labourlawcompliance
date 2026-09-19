import type { Filing } from '@/types/filing.types';
import type {
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
 */
export const buildWhatsAppSourceData = (
  filing: Filing,
  recipientNameOverride?: string,
): WhatsAppSourceData => {
  const { monthName, year } = parsePeriod(filing.period);

  return {
    recipientName: String(
      recipientNameOverride ?? filing.client?.recipientName ?? '',
    ).trim(),
    companyName: String(filing.client?.companyName ?? '').trim(),
    clientCode: String(filing.clientCode ?? '').trim(),
    month: monthName,
    year,
    periodLabel: String(filing.periodLabel ?? '').trim(),
    signatoryName: String(filing.client?.signatoryName ?? '').trim(),
  };
};

/**
 * Resolve a template's bodyPreview by substituting tokens with source data values.
 * Used for live preview in editor and send modals.
 */
export const resolveWhatsAppPreview = (
  bodyPreview: string,
  fields: WhatsAppTemplateField[],
  sourceData: WhatsAppSourceData,
): string => {
  let resolved = bodyPreview;

  for (const field of fields) {
    const value = sourceData[field.field] || '';
    // Replace all occurrences of the token with the value
    resolved = resolved.split(field.token).join(value);
  }

  return resolved;
};

/**
 * Extract variable list from bodyPreview by finding all known tokens in order.
 * Used for "Sync from placeholders" button in editor.
 */
export const extractVariablesFromBodyPreview = (
  bodyPreview: string,
  fields: WhatsAppTemplateField[],
): WhatsAppTemplateVariable[] => {
  const foundFields: Set<string> = new Set();
  const variables: WhatsAppTemplateVariable[] = [];

  // Find each token's first occurrence position
  const tokenPositions: Array<{ field: WhatsAppTemplateField; pos: number }> =
    [];

  for (const field of fields) {
    const pos = bodyPreview.indexOf(field.token);
    if (pos !== -1 && !foundFields.has(field.field)) {
      tokenPositions.push({ field, pos });
      foundFields.add(field.field);
    }
  }

  // Sort by position and build variables array
  tokenPositions.sort((a, b) => a.pos - b.pos);

  for (const { field } of tokenPositions) {
    variables.push({ field: field.field });
  }

  return variables;
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
