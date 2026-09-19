/**
 * Shared utilities for period/month formatting and parsing.
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
 * @param {string} period - Format: "YYYY-MM"
 * @returns {{monthName: string, year: string}} - e.g. {monthName: 'January', year: '2024'}
 */
export const periodMonthAndYear = (period) => {
  const match = String(period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return { monthName: '', year: '' };
  const month = Number(match[2]);
  return {
    monthName: MONTH_NAMES[month - 1] || match[2],
    year: match[1],
  };
};

export { MONTH_NAMES };
