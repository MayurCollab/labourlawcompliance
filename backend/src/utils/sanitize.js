/**
 * Allow-list sanitizer for user-supplied text stored in the DB.
 * Default: strip ALL HTML tags and angle brackets (plain text only).
 * For a future rich-text field, replace the stripper with an allow-list
 * library (e.g. sanitize-html) without changing call sites.
 */
export const sanitizeUserHtml = (value, _options = {}) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  return value
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/[<>]/g, '')
    .replace(/\0/g, '')
    .trim();
};

/** Escape for safe interpolation into HTML email templates. */
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Only allow http(s) URLs in email templates. */
export const sanitizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
};
