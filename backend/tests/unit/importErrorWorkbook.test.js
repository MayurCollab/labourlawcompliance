import * as XLSX from 'xlsx';
import { describe, expect, test } from '@jest/globals';

import {
  buildImportErrorWorkbook,
  hasImportErrors,
  importErrorFilename,
} from '../../src/modules/uploads/importErrorWorkbook.js';

const sheetRows = (buffer, name) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], {
    header: 1,
    raw: false,
    defval: '',
  });
};

describe('importErrorWorkbook', () => {
  test('filename strips the original extension', () => {
    expect(importErrorFilename('MasterSheet.xlsx')).toBe(
      'MasterSheet_errors.xlsx',
    );
    expect(importErrorFilename('Salary Sheet July-26.xlsx')).toBe(
      'Salary Sheet July-26_errors.xlsx',
    );
  });

  test('hasImportErrors is false when both lists are empty', () => {
    expect(hasImportErrors(null)).toBe(false);
    expect(
      hasImportErrors({ skipped: [], unmatched: [] }),
    ).toBe(false);
    expect(
      hasImportErrors({
        skipped: [{ row: 19, reason: 'Missing client code' }],
        unmatched: [],
      }),
    ).toBe(true);
  });

  test('workbook has a Skipped sheet and an Unmatched sheet', () => {
    const buffer = buildImportErrorWorkbook({
      skipped: [{ row: 19, reason: 'Missing client code' }],
      unmatched: [
        {
          row: 4,
          employeeNo: 'E9999',
          phyCode: '9999',
          reason: 'No client for PHY_CODE',
        },
      ],
    });

    const skipped = sheetRows(buffer, 'Skipped');
    const unmatched = sheetRows(buffer, 'Unmatched');

    expect(skipped[0]).toEqual(['Excel row', 'Reason']);
    expect(skipped[1]).toEqual(['19', 'Missing client code']);
    expect(unmatched[0]).toEqual(['Excel row', 'EMPNO', 'PHY_CODE', 'Reason']);
    expect(unmatched[1][1]).toBe('E9999');
    expect(unmatched[1][2]).toBe('9999');
  });
});
