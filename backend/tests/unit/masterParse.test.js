import { describe, expect, test } from '@jest/globals';

import {
  autoMapColumns,
  detectHeaderRow,
  extractPhyCode,
  mappingHasRequiredFields,
  parseMasterWorkbook,
  parsePeriod,
  stringifyCell,
} from '../../src/modules/uploads/masterParse.js';
import {
  buildMasterWorkbookBuffer,
  defaultMasterRow,
} from '../helpers/masterSheet.js';

describe('masterParse', () => {
  test('detects header row 17 and auto-maps Client / company / Reg No.', () => {
    const buffer = buildMasterWorkbookBuffer();
    const parsed = parseMasterWorkbook(buffer);

    expect(parsed.selectedSheet).toBe('July.26');
    expect(parsed.headerRow).toBe(17);
    expect(parsed.mapping.clientCode).toBe(3);
    expect(parsed.mapping.companyName).toBe(4);
    expect(parsed.mapping.locationName).toBe(6);
    expect(parsed.mapping.rcNumber).toBe(12);
    expect(parsed.mapping.month).toBe(15);
    expect(mappingHasRequiredFields(parsed.mapping)).toBe(true);
    expect(parsed.previewRows[0].cells.clientCode).toBe('C0001');
    expect(parsed.previewRows[0].excelRow).toBe(18);
    expect(defaultMasterRow[3]).toBe('C0001');
  });

  test('parsePeriod accepts Jul-2026, July-26, July.26 and YYYY-MM', () => {
    expect(parsePeriod('Jul-2026')).toBe('2026-07');
    expect(parsePeriod('July-26')).toBe('2026-07');
    expect(parsePeriod('', 'July.26')).toBe('2026-07');
    expect(parsePeriod('2026-07')).toBe('2026-07');
  });

  test('extractPhyCode pads bracket tags to four digits', () => {
    expect(extractPhyCode('SMFG India Credit Co. Ltd. [83]')).toBe('0083');
    expect(extractPhyCode('Acer India Pvt. Ltd.')).toBeNull();
  });

  test('stringifyCell formats dates as YYYY-MM-DD', () => {
    expect(stringifyCell(new Date(2026, 6, 15))).toBe('2026-07-15');
  });

  test('detectHeaderRow returns -1 when the three marker headers are missing', () => {
    expect(detectHeaderRow([['foo', 'bar']])).toBe(-1);
    const mapping = autoMapColumns(['No.', 'Something']);
    expect(mapping.clientCode).toBeNull();
  });
});
