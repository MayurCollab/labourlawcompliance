import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PizZip from 'pizzip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { describe, expect, test } from '@jest/globals';

import { emptyMapping } from '../../src/modules/templates/canonicalFields.js';
import { GUJARAT_DEFAULT_SLABS } from '../../src/modules/ptSlabs/ptSlabs.constants.js';
import {
  parseAnyTemplate,
  parseTemplateFile,
} from '../../src/modules/templates/templateParse.js';
import { fillTemplateBuffer } from '../../src/modules/templates/templateFill.js';
import {
  buildComputationFromMaster,
  buildForm5Values,
  form5Filename,
  periodBounds,
} from '../../src/modules/filings/form5Values.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, '../fixtures/Form5_Templete.xlsx');

const SLABS = [
  { salaryFrom: 0, salaryTo: 2999, rate: 0, label: 'Rs. 0 – 2,999' },
  {
    salaryFrom: 12000,
    salaryTo: null,
    rate: 200,
    label: 'Rs. 12,000 and above',
  },
];

const values = {
  scalars: {
    formTitle: 'Form 5',
    actName: 'Gujarat PT Act',
    periodMonthLabel: 'July-26',
    periodFrom: '01/07/2026',
    periodTo: '31/07/2026',
    employerName: 'SMFG India Credit Co. Ltd.',
    employerAddress: 'Anand branch',
    rcNumber: 'PRC016780178',
    signatoryName: 'Test Signatory',
    place: 'Anand',
    filingDate: '26/08/2026',
    receiptNumber: 'CH-99',
    paymentDate: '10/07/2026',
    amountPaid: 600,
    totalA: 600,
    totalB: 'NIL',
    interest: 'NIL',
    totalPayable: 600,
  },
  slabs: [
    {
      salaryFrom: 0,
      salaryTo: 2999,
      rate: 0,
      employeeCount: 0,
      exemptCount: 0,
      taxableCount: 0,
      taxAmount: 0,
    },
    {
      salaryFrom: 12000,
      salaryTo: null,
      rate: 200,
      employeeCount: 3,
      exemptCount: 0,
      taxableCount: 3,
      taxAmount: 600,
    },
  ],
};

const buildExcel = (rows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    'Form5',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const readSheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1,
    raw: false,
    defval: '',
  });
};

const buildDocx = (tokens) => {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://www.schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${tokens
    .map((token) => `<w:p><w:r><w:t>{{${token}}}</w:t></w:r></w:p>`)
    .join('')}</w:body>
</w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
};

describe('form5Values', () => {
  test('filename uses client, location, period', () => {
    expect(
      form5Filename({
        clientCode: 'C0099',
        locationName: 'Anand',
        period: '2026-07',
        ext: '.xlsx',
      }),
    ).toBe('C0099_Anand_2026-07_Form5.xlsx');
  });

  test('period bounds are first and last day', () => {
    expect(periodBounds('2026-07')).toEqual({
      from: '01/07/2026',
      to: '31/07/2026',
      label: 'July-26',
    });
  });

  test('buildForm5Values prefers company name and NIL for zero B/interest', () => {
    const built = buildForm5Values({
      filing: {
        clientCode: 'C0099',
        period: '2026-07',
        periodLabel: 'Jul-2026',
        challanNo: 'CH-1',
        ptAmount: 600,
        computation: {
          slabs: [],
          totalA: 600,
          totalB: 0,
          interest: 0,
          totalPayable: 600,
        },
      },
      client: {
        draftName: 'SMFG India Credit Co. Ltd.',
        companyName: 'SMFG',
        rcNumber: 'RC-1',
        address: 'Anand',
        location: { name: 'Anand' },
      },
      settings: { signatoryName: 'Global Signer' },
      generatedAt: new Date('2026-08-26T06:00:00.000Z'),
    });
    expect(built.scalars.employerName).toBe('SMFG');
    expect(built.scalars.companyName).toBe('SMFG');
    expect(built.scalars.signatoryName).toBe('Global Signer');
    expect(built.scalars.place).toBe('Anand');
    expect(built.scalars.totalB).toBe('NIL');
    expect(built.scalars.interest).toBe('NIL');
    expect(built.scalars.totalA).toBe(600);
    expect(built.scalars.periodFrom).toBe('01/07/2026');
  });

  test('buildForm5Values applies overrides, employees, and additional tax', () => {
    const built = buildForm5Values({
      filing: {
        clientCode: 'C0099',
        period: '2026-07',
        generateOverrides: {
          employerAddress: 'Manual address',
          signatoryName: 'Manual Signer',
          filingDate: new Date('2026-09-01T00:00:00.000Z'),
          additionalTaxPayable: 500,
        },
        computation: {
          slabs: [],
          totalA: 600,
          totalB: 0,
          interest: 0,
          totalEmployeeCount: 2,
          taxableEmployeeCount: 2,
          exemptEmployeeCount: 0,
        },
      },
      client: {
        companyName: 'SMFG',
        address: 'Client address',
        signatoryName: 'Client Signer',
        location: { name: 'Anand' },
      },
      settings: { signatoryName: 'Global Signer' },
      employees: [
        {
          srNo: 1,
          employeeNo: 'E1',
          employeeName: 'Asha',
          locationName: 'Anand',
          ptGross: 15000,
          pTax: 200,
        },
      ],
      templateCode: 'form5-general',
      generatedAt: new Date('2026-08-26T06:00:00.000Z'),
    });

    expect(built.scalars.employerAddress).toBe('Manual address');
    expect(built.scalars.signatoryName).toBe('Manual Signer');
    expect(built.scalars.filingDate).toBe('01/09/2026');
    expect(built.scalars.additionalTaxPayable).toBe(500);
    expect(built.scalars.totalPayable).toBe(1100);
    expect(built.employees).toHaveLength(1);
    expect(built.meta.templateCode).toBe('form5-general');
  });

  test('buildComputationFromMaster fills 12k slab from Master PT amount', () => {
    const computation = buildComputationFromMaster(
      { ptAmount: 4400 },
      GUJARAT_DEFAULT_SLABS,
    );
    const top = computation.slabs.find((row) => row.salaryFrom === 12000);
    expect(computation.totalA).toBe(4400);
    expect(computation.totalPayable).toBe(4400);
    expect(top.employeeCount).toBe(22);
    expect(top.taxAmount).toBe(4400);
    expect(computation.source).toBe('master');
  });
});

describe('templateFill', () => {
  test('fills a mapped English Excel template including slabs and totals', async () => {
    const source = buildExcel([
      ['Form', '{{formTitle}}'],
      ['Employer', '{{employerName}}'],
      ['RC', '{{rcNumber}}'],
      ['Period', '{{periodMonthLabel}}'],
      ['From', '{{periodFrom}}'],
      ['To', '{{periodTo}}'],
      ['Signatory', '{{signatoryName}}'],
      ['Place', '{{place}}'],
      ['Date', '{{filingDate}}'],
      ['Count 12k', '{{slab_12000_employeeCount}}'],
      ['Tax 12k', '{{slab_12000_taxAmount}}'],
      ['Total A', '{{totalA}}'],
      ['Total B', '{{totalB}}'],
    ]);
    const parsed = parseTemplateFile(source, 'Form5_General.xlsx', SLABS);
    const filled = await fillTemplateBuffer({
      buffer: source,
      kind: 'excel',
      mapping: parsed.mapping,
      values,
    });
    const rows = readSheet(filled);
    const byLabel = Object.fromEntries(rows.map((row) => [row[0], row[1]]));
    expect(byLabel.Employer).toBe('SMFG India Credit Co. Ltd.');
    expect(byLabel.RC).toBe('PRC016780178');
    expect(byLabel.Period).toBe('July-26');
    expect(byLabel['Count 12k']).toBe('3');
    expect(byLabel['Tax 12k']).toBe('600');
    expect(byLabel['Total A']).toBe('600');
    expect(byLabel['Total B']).toBe('NIL');
    expect(byLabel.Signatory).toBe('Test Signatory');
    expect(byLabel.Place).toBe('Anand');
    expect(byLabel.Date).toBe('26/08/2026');
  });

  test('filling self-closing Excel cells does not emit broken XML', async () => {
    const buffer = fs.readFileSync(templatePath);
    const parsed = parseTemplateFile(buffer, 'Form5_Templete.xlsx', [
      ...GUJARAT_DEFAULT_SLABS,
    ]);
    const filled = await fillTemplateBuffer({
      buffer,
      kind: 'excel',
      mapping: parsed.mapping,
      values,
    });
    const zip = new PizZip(filled);
    const sheet = zip.file('xl/worksheets/sheet1.xml').asText();
    expect(sheet).not.toMatch(/\/\s+t="/);
    expect(sheet).toContain('topLeftCell="A1"');
    expect(zip.file('xl/drawings/drawing1.xml')).toBeTruthy();
  });

  test('a second template fills via cell mapping without new generator code', async () => {
    const source = buildExcel([
      ['Employer', ''],
      ['RC', ''],
    ]);
    const mapping = emptyMapping(SLABS);
    mapping.scalars.employerName = 'B1';
    mapping.scalars.rcNumber = 'B2';
    const filled = await fillTemplateBuffer({
      buffer: source,
      kind: 'excel',
      mapping,
      values,
    });
    const rows = readSheet(filled);
    expect(rows[0][1]).toBe('SMFG India Credit Co. Ltd.');
    expect(rows[1][1]).toBe('PRC016780178');
  });

  test('DOCX replaces mapped {{placeholders}}', async () => {
    const source = buildDocx(['employerName', 'rcNumber']);
    const parsed = parseTemplateFile(source, 'Form5.docx', SLABS);
    const filled = await fillTemplateBuffer({
      buffer: source,
      kind: 'docx',
      mapping: parsed.mapping,
      values,
    });
    const zip = new PizZip(filled);
    const xml = zip.file('word/document.xml').asText();
    expect(xml).toContain('SMFG India Credit Co. Ltd.');
    expect(xml).toContain('PRC016780178');
    expect(xml).not.toContain('{{employerName}}');
  });

  test('highlighted Word runs are replaced from the mapping', async () => {
    const zip = new PizZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r>
      <w:rPr><w:highlight w:val="yellow"/><w:rFonts w:ascii="Verdana"/></w:rPr>
      <w:t>OLD CO</w:t>
    </w:r></w:p>
  </w:body>
</w:document>`,
    );
    const source = zip.generate({ type: 'nodebuffer' });
    const parsed = parseTemplateFile(source, 'District.docx', SLABS);
    const bind = parsed.cells[0].bind;
    parsed.mapping.scalars.employerName = bind;
    parsed.mapping.scalars.place = null;
    const filled = await fillTemplateBuffer({
      buffer: source,
      kind: 'docx',
      mapping: parsed.mapping,
      values,
    });
    const xml = new PizZip(filled).file('word/document.xml').asText();
    expect(xml).toContain('SMFG India Credit Co. Ltd.');
    expect(xml).not.toContain('OLD CO');
  });

  test('PDF coloured boxes are overlaid from the mapping', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 300]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({
      x: 40,
      y: 200,
      width: 220,
      height: 18,
      color: rgb(1, 1, 0),
    });
    page.drawText('OLD CO', { x: 44, y: 204, size: 10, font });
    const source = Buffer.from(await pdf.save());
    const parsed = await parseAnyTemplate(source, 'Form5.pdf', SLABS);
    parsed.mapping.scalars.employerName = parsed.cells[0].bind;
    parsed.mapping.scalars.place = null;
    const filled = await fillTemplateBuffer({
      buffer: source,
      kind: 'pdf',
      mapping: parsed.mapping,
      values,
    });
    const after = await parseAnyTemplate(filled, 'Form5.pdf', SLABS);
    expect(after.cells.some((cell) => cell.value.includes('SMFG'))).toBe(true);
  });

  test('HTML templates fill via Handlebars without mapping', async () => {
    const source = Buffer.from(
      '<h1>{{employerName}}</h1><p>{{#each slabs}}{{employeeCount}}{{/each}}</p>',
      'utf8',
    );
    const filled = await fillTemplateBuffer({
      buffer: source,
      kind: 'html',
      mapping: emptyMapping(),
      values,
    });
    const html = filled.toString('utf8');
    expect(html).toContain('SMFG India Credit Co. Ltd.');
    expect(html).toContain('3');
  });
});
