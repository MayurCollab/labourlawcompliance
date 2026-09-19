const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits a pasted search box value into distinct tokens so users can paste a
 * column of codes copied from Excel (one per line) instead of typing them
 * one at a time. Accepts newlines, commas, semicolons, and tabs as separators.
 */
export const splitSearchTokens = (search) => {
  if (!search) return [];
  return [
    ...new Set(
      String(search)
        .split(/[\n\r,;\t]+/)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ];
};

/**
 * Case-insensitive regex matching any one of the given tokens, anchored to
 * the whole field value (exact match, not substring) — for looking up an
 * exact code list rather than free-text search.
 */
export const exactMatchRegex = (tokens) =>
  new RegExp(`^(?:${tokens.map(escapeRegex).join('|')})$`, 'i');

export { escapeRegex };
