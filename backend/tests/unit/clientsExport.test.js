import * as XLSX from 'xlsx';
import { describe, expect, test } from '@jest/globals';

import {
  CLIENT_EXPORT_HEADERS,
  buildClientsWorkbook,
  clientExportFilename,
  clientToExportRow,
} from '../../src/modules/clients/clientsExport.js';

const sheetRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(workbook.Sheets.Clients, {
    header: 1,
    raw: false,
    defval: '',
  });
};

describe('clientsExport', () => {
  test('filename uses an ISO date stamp', () => {
    expect(clientExportFilename(new Date('2026-09-07T12:00:00.000Z'))).toBe(
      'clients-2026-09-07.xlsx',
    );
  });

  test('maps a client to spreadsheet columns', () => {
    expect(
      clientToExportRow({
        clientCode: 'C0001',
        companyName: 'Acer India Pvt. Ltd. [0083]',
        draftName: 'Acer India',
        location: { name: 'Ahmedabad' },
        authorityName: null,
        address: 'First floor, SG Highway',
        rcNumber: 'PRC016780178',
        contactNumber: null,
        fundCode: 'G0001',
        phyCode: '0083',
        status: 'G',
        signatoryName: 'A. Signatory',
        includeEmployeesOnForm5: true,
      }),
    ).toEqual([
      'C0001',
      'Acer India Pvt. Ltd. [0083]',
      'Acer India',
      'Ahmedabad',
      '',
      'First floor, SG Highway',
      'PRC016780178',
      '',
      'G0001',
      '0083',
      'G',
      'A. Signatory',
      'Yes',
    ]);
  });

  test('workbook includes a header row even when there are no clients', () => {
    const { buffer, filename, mimetype } = buildClientsWorkbook([]);
    expect(filename).toMatch(/^clients-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(mimetype).toContain('spreadsheetml');
    expect(sheetRows(buffer)[0]).toEqual([...CLIENT_EXPORT_HEADERS]);
  });

  test('workbook writes one data row per client', () => {
    const { buffer } = buildClientsWorkbook([
      {
        clientCode: 'C0002',
        companyName: 'Beta Ltd.',
        location: { name: 'Surat' },
        includeEmployeesOnForm5: false,
      },
    ]);
    const rows = sheetRows(buffer);
    expect(rows[1][0]).toBe('C0002');
    expect(rows[1][1]).toBe('Beta Ltd.');
    expect(rows[1][3]).toBe('Surat');
    expect(rows[1][12]).toBe('No');
  });
});
