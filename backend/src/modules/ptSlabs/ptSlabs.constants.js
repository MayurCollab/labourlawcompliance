/**
 * Gujarat PT slab table. Rates live in the DB (not the generator) so a
 * later revision is a data change: add rows with a new effectiveFrom.
 */
export const PT_SLABS_CODES = Object.freeze({
  SLAB_NOT_FOUND: 'SLAB_NOT_FOUND',
  SLAB_OVERLAP: 'SLAB_OVERLAP',
  INVALID_RANGE: 'INVALID_RANGE',
});

export const PT_SLABS_MESSAGES = Object.freeze({
  CREATED: 'PT slab created successfully.',
  UPDATED: 'PT slab updated successfully.',
  DELETED: 'PT slab deleted successfully.',
  FETCHED: 'PT slabs fetched successfully.',
});

/** First day the current Gujarat table is treated as in force. */
export const GUJARAT_DEFAULT_EFFECTIVE_FROM = new Date(
  '2019-04-01T00:00:00.000Z',
);

export const GUJARAT_DEFAULT_SLABS = Object.freeze([
  {
    salaryFrom: 0,
    salaryTo: 2999,
    rate: 0,
    label: 'Rs. 0 – 2,999',
    sortOrder: 1,
  },
  {
    salaryFrom: 3000,
    salaryTo: 5999,
    rate: 0,
    label: 'Rs. 3,000 – 5,999',
    sortOrder: 2,
  },
  {
    salaryFrom: 6000,
    salaryTo: 8999,
    rate: 80,
    label: 'Rs. 6,000 – 8,999',
    sortOrder: 3,
  },
  {
    salaryFrom: 9000,
    salaryTo: 11999,
    rate: 150,
    label: 'Rs. 9,000 – 11,999',
    sortOrder: 4,
  },
  {
    salaryFrom: 12000,
    salaryTo: null,
    rate: 200,
    label: 'Rs. 12,000 and above',
    sortOrder: 5,
  },
]);
