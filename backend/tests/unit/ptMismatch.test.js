import { describe, expect, test } from '@jest/globals';

import { buildPtMismatch, rupees, toPtMismatchDto } from '../../src/modules/filings/ptMismatch.js';

describe('ptMismatch', () => {
  test('rupees rounds to whole rupees', () => {
    expect(rupees(1000.4)).toBe(1000);
    expect(rupees('800')).toBe(800);
    expect(rupees(null)).toBeNull();
  });

  test('flags master sheet total that does not match salary employees', () => {
    expect(
      buildPtMismatch({
        ptAmount: 1000,
        salaryPtTotal: 800,
        employeeCount: 4,
      }),
    ).toEqual({
      salaryPtTotal: 800,
      salaryEmployeeCount: 4,
      ptMismatch: true,
      ptMismatchDelta: 200,
    });
  });

  test('does not warn when totals match', () => {
    expect(
      buildPtMismatch({
        ptAmount: 800,
        salaryPtTotal: 800,
        employeeCount: 4,
      }).ptMismatch,
    ).toBe(false);
  });

  test('does not warn when salary employees are missing', () => {
    expect(
      buildPtMismatch({
        ptAmount: 1000,
        salaryPtTotal: 0,
        employeeCount: 0,
      }).ptMismatch,
    ).toBe(false);
  });

  test('toPtMismatchDto drops matching rows', () => {
    expect(
      toPtMismatchDto({
        id: '1',
        clientCode: 'C1234',
        ptMismatch: false,
      }),
    ).toBeNull();
    expect(
      toPtMismatchDto({
        id: '1',
        clientCode: 'C1234',
        client: { companyName: 'Acme' },
        ptAmount: 1000,
        salaryPtTotal: 800,
        salaryEmployeeCount: 4,
        ptMismatch: true,
        ptMismatchDelta: 200,
      }),
    ).toMatchObject({
      id: '1',
      clientCode: 'C1234',
      companyName: 'Acme',
      ptAmount: 1000,
      salaryPtTotal: 800,
      salaryEmployeeCount: 4,
      ptMismatchDelta: 200,
    });
  });
});
