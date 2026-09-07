/**
 * Pure PT slab math. Rates come from DB slabs, not this file.
 * Unmatched employees are excluded from counts until mapped.
 */

export const VARIANCE_LIMIT = 50;

const asNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
 * Sheet P_TAX is kept only to flag variances.
 */
export const computePt = (slabs, employees = []) => {
  const buckets = (slabs || []).map(emptyBucket);
  const variances = [];
  let unmatchedExcluded = 0;
  let unslottedCount = 0;
  let employeeCount = 0;

  for (const employee of employees || []) {
    if (employee.unmatched) {
      unmatchedExcluded += 1;
      continue;
    }

    const slab = findSlabForGross(slabs, employee.ptGross);
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
        ptGross: asNumber(employee.ptGross),
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
    varianceCount: variances.length,
    variances: variances.slice(0, VARIANCE_LIMIT),
  };
};
