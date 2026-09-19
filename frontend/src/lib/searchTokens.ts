/**
 * Splits a pasted search value into distinct tokens so users can paste a
 * column of codes copied from Excel (one per line) instead of typing them
 * one at a time. Accepts newlines, commas, semicolons, and tabs as separators.
 */
export const splitSearchTokens = (value: string): string[] => {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[\n\r,;\t]+/)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ];
};

/** True when the raw clipboard text contains more than one search token. */
export const isMultiValuePaste = (raw: string): boolean =>
  splitSearchTokens(raw).length > 1;
