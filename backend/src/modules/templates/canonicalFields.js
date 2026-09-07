/**
 * Canonical Form 5 fields. Templates bind these keys to {{placeholders}}
 * or Excel cells (F14). Slab rows match by salaryFrom/salaryTo/rate, not index.
 */

export const CANONICAL_SCALAR_FIELDS = Object.freeze([
  { key: 'formTitle', label: 'Form title', group: 'header' },
  { key: 'actName', label: 'Act name', group: 'header' },
  { key: 'periodMonthLabel', label: 'Period label', group: 'period' },
  { key: 'periodFrom', label: 'Period from', group: 'period' },
  { key: 'periodTo', label: 'Period to', group: 'period' },
  { key: 'employerName', label: 'Employer name', group: 'employer' },
  { key: 'employerAddress', label: 'Employer address', group: 'employer' },
  { key: 'rcNumber', label: 'RC / Reg No.', group: 'employer' },
  { key: 'signatoryName', label: 'Signatory', group: 'employer' },
  { key: 'place', label: 'Place', group: 'employer' },
  { key: 'filingDate', label: 'Filing date', group: 'payment' },
  { key: 'receiptNumber', label: 'Receipt / challan no.', group: 'payment' },
  { key: 'paymentDate', label: 'Payment date', group: 'payment' },
  { key: 'amountPaid', label: 'Amount paid', group: 'payment' },
  { key: 'totalA', label: 'Total A', group: 'totals' },
  { key: 'totalB', label: 'Total B', group: 'totals' },
  { key: 'interest', label: 'Interest', group: 'totals' },
  { key: 'totalPayable', label: 'Total payable', group: 'totals' },
]);

export const SLAB_BIND_KEYS = Object.freeze([
  { key: 'label', label: 'Label' },
  { key: 'salaryFrom', label: 'Salary from' },
  { key: 'salaryTo', label: 'Salary to' },
  { key: 'employeeCount', label: 'Employee count' },
  { key: 'exemptCount', label: 'Exempt count' },
  { key: 'taxableCount', label: 'Taxable count' },
  { key: 'rate', label: 'Rate' },
  { key: 'taxAmount', label: 'Tax amount' },
]);

export const SCALAR_KEYS = Object.freeze(
  CANONICAL_SCALAR_FIELDS.map((field) => field.key),
);

export const SLAB_KEYS = Object.freeze(SLAB_BIND_KEYS.map((field) => field.key));

export const emptyBinds = () =>
  Object.fromEntries(SLAB_KEYS.map((key) => [key, null]));

export const emptyScalarMapping = () =>
  Object.fromEntries(SCALAR_KEYS.map((key) => [key, null]));

export const emptySlabRow = (slab) => ({
  salaryFrom: slab.salaryFrom,
  salaryTo: slab.salaryTo ?? null,
  rate: slab.rate,
  label: slab.label || '',
  binds: emptyBinds(),
});

export const emptyMapping = (slabs = []) => ({
  scalars: emptyScalarMapping(),
  slabs: slabs.map(emptySlabRow),
});

export const canonicalSchema = () => ({
  scalars: CANONICAL_SCALAR_FIELDS,
  slabBinds: SLAB_BIND_KEYS,
});
