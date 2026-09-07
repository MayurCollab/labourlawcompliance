import { describe, expect, test } from '@jest/globals';

import {
  extractPeriodFromText,
  normalizePhyCode,
} from '../../src/modules/uploads/masterParse.js';
import {
  parseSalaryWorkbook,
  pickSalarySheet,
} from '../../src/modules/uploads/salaryParse.js';
import { buildSalaryWorkbookBuffer } from '../helpers/salarySheet.js';

describe('salaryParse', () => {
  test('detects OutPut header row 2 and auto-maps EMPNO / PHY_CODE / PT GROSS', () => {
    const buffer = buildSalaryWorkbookBuffer();
    const parsed = parseSalaryWorkbook(
      buffer,
      null,
      'Salary Sheet July-26.xlsx',
    );

    expect(parsed.selectedSheet).toBe('OutPut');
    expect(parsed.headerRow).toBe(2);
    expect(parsed.mapping.employeeNo).toBe(1);
    expect(parsed.mapping.phyCode).toBe(6);
    expect(parsed.mapping.ptGross).toBe(5);
    expect(parsed.previewRows[0].cells.employeeNo).toBe('E1001');
    expect(parsed.suggestedPeriod).toBe('2026-07');
  });

  test('prefers OutPut over Sheet2 even when Sheet2 has similar headers', () => {
    const buffer = buildSalaryWorkbookBuffer([ [1, 'E1', 'A', 'X', 'Gujarat', 13000, '0083', 200] ], {
      extraSheets: {
        Sheet2: [
          ['SRNO', 'EMPNO', 'EMP_NAME', 'LOCATION', 'STATE', 'PT GROSS', 'PHY_CODE', 'P_TAX'],
          [1, 'PIVOT', 'Ignore', 'X', 'Gujarat', 1, '0001', 0],
        ],
      },
    });
    const parsed = parseSalaryWorkbook(buffer);
    expect(parsed.selectedSheet).toBe('OutPut');
    expect(pickSalarySheet(parsed.sheetNames, parsed.rowsBySheet)).toBe('OutPut');
  });

  test('normalizePhyCode pads numeric codes', () => {
    expect(normalizePhyCode(83)).toBe('0083');
    expect(normalizePhyCode('83')).toBe('0083');
    expect(normalizePhyCode('0083')).toBe('0083');
    expect(normalizePhyCode('')).toBeNull();
  });

  test('extractPeriodFromText finds July-26 inside a filename', () => {
    expect(extractPeriodFromText('Salary Sheet July-26.xlsx')).toBe('2026-07');
  });
});
