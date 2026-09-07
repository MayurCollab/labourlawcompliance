import { GUJARAT_DEFAULT_SLABS } from '../../src/modules/ptSlabs/ptSlabs.constants.js';
import {
  computePt,
  findSlabForGross,
  periodToDate,
} from '../../src/modules/filings/ptCompute.js';
import { describe, expect, test } from '@jest/globals';

const employee = (no, ptGross, extra = {}) => ({
  employeeNo: no,
  ptGross,
  pTax: extra.pTax ?? 200,
  unmatched: extra.unmatched ?? false,
});

describe('ptCompute', () => {
  test('periodToDate converts YYYY-MM to the first UTC day', () => {
    expect(periodToDate('2026-07')?.toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );
    expect(periodToDate('bad')).toBeNull();
  });

  test('findSlabForGross puts 12,000+ into the open-ended Gujarat band', () => {
    const slab = findSlabForGross(GUJARAT_DEFAULT_SLABS, 12478);
    expect(slab?.salaryFrom).toBe(12000);
    expect(slab?.rate).toBe(200);
    expect(findSlabForGross(GUJARAT_DEFAULT_SLABS, 11999)?.rate).toBe(150);
    expect(findSlabForGross(GUJARAT_DEFAULT_SLABS, 0)?.rate).toBe(0);
  });

  test('SMFG-style 12,000+ dump: one taxable slab, count × 200 = Total A', () => {
    const employees = [
      employee('E1001', 12478),
      employee('E1002', 15000),
      employee('E2000', 20000),
      employee('E9999', 13000, { unmatched: true }),
    ];

    const result = computePt(GUJARAT_DEFAULT_SLABS, employees);
    const top = result.slabs.find((row) => row.salaryFrom === 12000);

    expect(result.employeeCount).toBe(3);
    expect(result.unmatchedExcluded).toBe(1);
    expect(result.unslottedCount).toBe(0);
    expect(top.employeeCount).toBe(3);
    expect(top.taxableCount).toBe(3);
    expect(top.exemptCount).toBe(0);
    expect(top.taxAmount).toBe(3 * 200);
    expect(result.totalA).toBe(600);
    expect(result.totalB).toBe(0);
    expect(result.interest).toBe(0);
    expect(result.totalPayable).toBe(600);
    expect(result.varianceCount).toBe(0);
    expect(result.slabs.filter((row) => row.employeeCount === 0)).toHaveLength(
      4,
    );
  });

  test('flags sheet P_TAX that does not match the computed slab rate', () => {
    const result = computePt(GUJARAT_DEFAULT_SLABS, [
      employee('E1', 13000, { pTax: 150 }),
      employee('E2', 7000, { pTax: 80 }),
    ]);

    expect(result.slabs.find((row) => row.salaryFrom === 6000).taxAmount).toBe(
      80,
    );
    expect(result.totalA).toBe(280);
    expect(result.varianceCount).toBe(1);
    expect(result.variances[0]).toMatchObject({
      employeeNo: 'E1',
      sheetPTax: 150,
      computedRate: 200,
    });
  });
});
