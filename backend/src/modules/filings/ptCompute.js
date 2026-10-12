/**
 * Pure PT slab math. Rates come from DB slabs, not this file.
 * Unmatched employees are excluded from counts until mapped.
 */

export const VARIANCE_LIMIT = 50;

/** When salary PT GROSS is blank/0/dash, P.Tax is this fixed rate. */
export const DEFAULT_PT_WITHOUT_GROSS = 200;

const DASH_GROSS = new Set(['-', '–', '—', '−']);

const asNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * True when PT GROSS is missing or placeholder (blank, dash, or 0).
 * Those rows use the fixed ₹200 rate instead of the exempt slab.
 */
export const isMissingPtGross = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text || DASH_GROSS.has(text)) return true;
  }
  const amount = asNumber(value);
  return amount === null || amount === 0;
};

/** PT GROSS for slab lookup: blank / dash / 0 → null (means apply ₹200). */
export const asPtGross = (value) => {
  if (isMissingPtGross(value)) return null;
  return asNumber(value);
};

/** First UTC day of a YYYY-MM period — used to pick effective-dated slabs. */
export const periodToDate = (period) => {
  const match = String(period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
};

export const findSlabForGross = (slabs, ptGross) => {
  const amount = asNumber(ptGross);
  if (amount === null) return null;
  return (
    slabs.find((slab) => {
      const from = asNumber(slab.salaryFrom) ?? 0;
      const to = asNumber(slab.salaryTo);
      if (amount < from) return false;
      if (to === null) return true;
      return amount <= to;
    }) ?? null
  );
};

/** Open-ended top band used when PT GROSS is missing (fixed ₹200). */
export const findDefaultPtSlab = (slabs = []) => {
  const openEnded = (slabs || []).find(
    (slab) => asNumber(slab.salaryTo) === null,
  );
  if (openEnded) return openEnded;
  return (
    (slabs || []).find(
      (slab) => asNumber(slab.rate) === DEFAULT_PT_WITHOUT_GROSS,
    ) ?? null
  );
};

/**
 * Pick the slab for an employee. Missing / 0 / dash PT GROSS → top open slab / ₹200.
 */
export const findSlabForEmployee = (slabs, ptGross) => {
  const amount = asPtGross(ptGross);
  if (amount === null) return findDefaultPtSlab(slabs);
  return findSlabForGross(slabs, amount);
};

/**
 * P.Tax for salary/Form 5: slab rate from PT GROSS, ₹200 when gross is
 * blank / dash / 0, or 0 when gross does not fall in any active slab.
 */
export const resolvePTax = (slabs, ptGross) => {
  const amount = asPtGross(ptGross);
  if (amount === null) return DEFAULT_PT_WITHOUT_GROSS;
  const slab = findSlabForGross(slabs, amount);
  if (slab?.rate !== undefined && slab?.rate !== null) return slab.rate;
  return 0;
};

const emptyBucket = (slab) => ({
  label: slab.label || '',
  salaryFrom: slab.salaryFrom,
  salaryTo: slab.salaryTo ?? null,
  rate: slab.rate,
  employeeCount: 0,
  exemptCount: 0,
  taxableCount: 0,
  taxAmount: 0,
});

/**
 * Bucket matched employees by PT GROSS. Tax uses the slab rate, not sheet P_TAX.
 * Blank / dash / 0 PT GROSS uses the open-ended (₹200) band.
 * Sheet P_TAX flags variances only.
 */
export const computePt = (slabs, employees = []) => {
  const buckets = (slabs || []).map(emptyBucket);
  const variances = [];
  let unmatchedExcluded = 0;
  let unslottedCount = 0;
  let employeeCount = 0;
  let missingGrossCount = 0;

  for (const employee of employees || []) {
    if (employee.unmatched) {
      unmatchedExcluded += 1;
      continue;
    }

    const missingGross = isMissingPtGross(employee.ptGross);
    if (missingGross) missingGrossCount += 1;

    const slab = findSlabForEmployee(slabs, employee.ptGross);
    if (!slab) {
      unslottedCount += 1;
      continue;
    }

    const bucket = buckets.find(
      (row) =>
        row.salaryFrom === slab.salaryFrom &&
        (row.salaryTo ?? null) === (slab.salaryTo ?? null) &&
        row.rate === slab.rate,
    );
    if (!bucket) {
      unslottedCount += 1;
      continue;
    }

    employeeCount += 1;
    bucket.employeeCount += 1;
    if (slab.rate === 0) {
      bucket.exemptCount += 1;
    } else {
      bucket.taxableCount += 1;
    }
    bucket.taxAmount += slab.rate;

    const sheetPTax = asNumber(employee.pTax);
    if (sheetPTax !== null && sheetPTax !== slab.rate) {
      variances.push({
        employeeNo: String(employee.employeeNo ?? ''),
        ptGross: asPtGross(employee.ptGross),
        sheetPTax,
        computedRate: slab.rate,
      });
    }
  }

  const totalA = buckets.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalB = 0;
  const interest = 0;

  return {
    slabs: buckets,
    totalA,
    totalB,
    interest,
    totalPayable: totalA + totalB + interest,
    employeeCount,
    unmatchedExcluded,
    unslottedCount,
    missingGrossCount,
    varianceCount: variances.length,
    variances: variances.slice(0, VARIANCE_LIMIT),
  };
};
