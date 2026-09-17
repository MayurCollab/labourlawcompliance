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

/**
 * Official Form 5 grid shape (five salary bands). Used by HTML fill /
 * template seeding only — not what the PT slabs master seeds into the DB.
 */
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

/**
 * Active PT calculation table stored in the DB / PT slabs master.
 * Gross below 12,000 → no matching band → P.Tax 0.
 */
export const ACTIVE_PT_CALC_EFFECTIVE_FROM = new Date(
  '2026-07-01T00:00:00.000Z',
);

export const ACTIVE_PT_CALC_SLABS = Object.freeze([
  {
    salaryFrom: 12000,
    salaryTo: null,
    rate: 200,
    label: 'Rs. 12,000 and above',
    sortOrder: 1,
  },
]);
