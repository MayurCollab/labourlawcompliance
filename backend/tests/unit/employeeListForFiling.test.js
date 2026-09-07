import { describe, expect, test } from '@jest/globals';

import {
  employeeCountsForList,
  employeeMatchesClient,
  employeesForClientLocation,
  filterEmployeesForClientLocation,
  normalizeLocationName,
} from '../../src/modules/filings/employeeListForFiling.js';

const client = {
  id: 'client-1',
  clientCode: 'C0001',
  phyCode: '83',
  location: { name: 'Anand' },
};

const slabs = [
  { salaryFrom: 0, salaryTo: 2999, rate: 0 },
  { salaryFrom: 12000, salaryTo: null, rate: 200 },
];

const employees = [
  {
    employeeNo: 'E2',
    employeeName: 'B',
    period: '2026-07',
    client: 'client-1',
    phyCode: '0083',
    locationName: 'Anand',
    ptGross: 15000,
    pTax: 200,
    unmatched: false,
  },
  {
    employeeNo: 'E1',
    employeeName: 'A',
    period: '2026-07',
    client: 'client-1',
    phyCode: '0083',
    locationName: 'Anand',
    ptGross: 2000,
    pTax: 0,
    unmatched: false,
  },
  {
    employeeNo: 'E3',
    employeeName: 'Other city',
    period: '2026-07',
    client: 'client-1',
    phyCode: '0083',
    locationName: 'Ahmedabad',
    ptGross: 15000,
    pTax: 200,
    unmatched: false,
  },
  {
    employeeNo: 'E4',
    employeeName: 'Unmatched',
    period: '2026-07',
    client: null,
    phyCode: '9999',
    locationName: 'Anand',
    ptGross: 15000,
    pTax: 200,
    unmatched: true,
  },
];

describe('employeeListForFiling', () => {
  test('normalizeLocationName is case-insensitive', () => {
    expect(normalizeLocationName(' Anand ')).toBe('anand');
  });

  test('employeeMatchesClient by client id or phy code', () => {
    expect(employeeMatchesClient(employees[0], client)).toBe(true);
    expect(employeeMatchesClient(employees[3], client)).toBe(false);
  });

  test('filterEmployeesForClientLocation keeps client/PHY matches even at another city', () => {
    const filtered = filterEmployeesForClientLocation({
      employees,
      client,
      period: '2026-07',
    });
    expect(filtered.map((row) => row.employeeNo)).toEqual(['E1', 'E2', 'E3']);
  });

  test('employeesForClientLocation adds srNo and sorts by employeeNo', () => {
    const listed = employeesForClientLocation({
      employees,
      client,
      period: '2026-07',
      slabs,
    });
    expect(listed).toHaveLength(3);
    expect(listed[0]).toMatchObject({ srNo: 1, employeeNo: 'E1' });
    expect(listed[1]).toMatchObject({ srNo: 2, employeeNo: 'E2' });
    expect(listed[2]).toMatchObject({ srNo: 3, employeeNo: 'E3' });
  });

  test('employeeCountsForList splits taxable and exempt', () => {
    const listed = employeesForClientLocation({
      employees,
      client,
      period: '2026-07',
      slabs,
    });
    expect(employeeCountsForList(listed, slabs)).toEqual({
      totalEmployeeCount: 3,
      taxableEmployeeCount: 2,
      exemptEmployeeCount: 1,
    });
  });
});
