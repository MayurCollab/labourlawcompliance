import PizZip from 'pizzip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { describe, expect, test } from '@jest/globals';

import { emptyMapping } from '../../src/modules/templates/canonicalFields.js';
import {
  autoMapFromPlaceholders,
  parseAnyTemplate,
  parseSlabToken,
  parseTemplateFile,
  slugFromFilename,
} from '../../src/modules/templates/templateParse.js';

const GUJARAT_SLABS = [
  { salaryFrom: 0, salaryTo: 2999, rate: 0, label: 'Rs. 0 – 2,999' },
  { salaryFrom: 12000, salaryTo: null, rate: 200, label: 'Rs. 12,000 and above' },
];

const buildExcel = () => {
  const aoa = [
    ['Form 5', '{{formTitle}}'],
    ['Employer', '{{employerName}}'],
    ['RC', '{{rcNumber}}'],
    ['Count 12000+', '{{slab_12000_employeeCount}}'],
    ['Tax 12000+', '{{slab_12000_taxAmount}}'],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(aoa),
    'Form5',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const buildDocx = () => {
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
    <w:p><w:r><w:t>{{employerName}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{rcNumber}}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
};

describe('templateParse', () => {
  test('slugFromFilename strips extension and pads hyphens', () => {
    expect(slugFromFilename('Form5_General.xlsm')).toBe('form5-general');
  });

  test('parseSlabToken reads from/to/bind from a placeholder name', () => {
    expect(parseSlabToken('slab_12000_employeeCount')).toEqual({
      salaryFrom: 12000,
      salaryTo: null,
      bindKey: 'employeeCount',
    });
    expect(parseSlabToken('slab_0_2999_taxAmount')).toEqual({
      salaryFrom: 0,
      salaryTo: 2999,
      bindKey: 'taxAmount',
    });
  });

  test('Excel auto-maps canonical placeholders including a 12,000+ slab bind', () => {
    const parsed = parseTemplateFile(
      buildExcel(),
      'Form5_General.xlsx',
      GUJARAT_SLABS,
    );
    expect(parsed.kind).toBe('excel');
    expect(parsed.mapping.scalars.employerName).toBe('{{employerName}}');
    expect(parsed.mapping.scalars.rcNumber).toBe('{{rcNumber}}');
    const top = parsed.mapping.slabs.find((row) => row.salaryFrom === 12000);
    expect(top.binds.employeeCount).toBe('{{slab_12000_employeeCount}}');
    expect(top.binds.taxAmount).toBe('{{slab_12000_taxAmount}}');
  });

  test('DOCX extracts {{placeholders}} without a district-specific layout', () => {
    const parsed = parseTemplateFile(
      buildDocx(),
      'Anand-unicode.docx',
      GUJARAT_SLABS,
    );
    expect(parsed.kind).toBe('docx');
    expect(parsed.placeholders).toEqual(
      expect.arrayContaining(['employerName', 'rcNumber']),
    );
    expect(parsed.mapping.scalars.employerName).toBe('{{employerName}}');
  });

  test('a second mapping can bind the same canonical keys to different targets', () => {
    const first = autoMapFromPlaceholders(
      ['employerName'],
      emptyMapping(GUJARAT_SLABS),
    );
    const second = emptyMapping(GUJARAT_SLABS);
    second.scalars.employerName = 'B12';
    expect(first.scalars.employerName).toBe('{{employerName}}');
    expect(second.scalars.employerName).toBe('B12');
    expect(first.slabs).toHaveLength(second.slabs.length);
  });

  test('highlighted Word runs become bind targets and auto-map employer/RC', () => {
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
    <w:p>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Gujrati Saral-1"/></w:rPr>
        <w:t>kame raqnarnu nam:</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:highlight w:val="yellow"/><w:rFonts w:ascii="Verdana"/></w:rPr>
        <w:t>SMFG India Credit Co. Ltd</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:highlight w:val="yellow"/><w:rFonts w:ascii="Verdana"/></w:rPr>
        <w:t>PRN-1540000412</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:highlight w:val="yellow"/><w:rFonts w:ascii="Verdana"/></w:rPr>
        <w:t>Apr</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:highlight w:val="yellow"/><w:rFonts w:ascii="Verdana"/></w:rPr>
        <w:t>-26</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
    );
    const source = zip.generate({ type: 'nodebuffer' });
    const parsed = parseTemplateFile(source, 'Surendranagar Form 5.docx', GUJARAT_SLABS);
    expect(parsed.cells.map((cell) => cell.value)).toEqual(
      expect.arrayContaining([
        'SMFG India Credit Co. Ltd',
        'PRN-1540000412',
        'Apr-26',
      ]),
    );
    expect(parsed.mapping.scalars.employerName).toMatch(/^docx:\d+-\d+$/);
    expect(parsed.mapping.scalars.rcNumber).toMatch(/^docx:\d+-\d+$/);
    expect(parsed.mapping.scalars.periodMonthLabel).toMatch(/^docx:\d+-\d+$/);
    expect(parsed.cells.map((cell) => cell.value).join(' ')).not.toMatch(/<w:t/);
  });

  test('PDF yellow boxes become bind targets', async () => {
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
    page.drawText('SMFG India Credit Co. Ltd', {
      x: 44,
      y: 204,
      size: 10,
      font,
    });
    page.drawRectangle({
      x: 40,
      y: 160,
      width: 80,
      height: 16,
      color: rgb(1, 1, 0),
    });
    page.drawText('Jul-26', { x: 44, y: 164, size: 10, font });
    const source = Buffer.from(await pdf.save());
    const parsed = await parseAnyTemplate(source, 'Form5.pdf', GUJARAT_SLABS);
    expect(parsed.kind).toBe('pdf');
    expect(parsed.cells.length).toBeGreaterThan(0);
    expect(parsed.cells.every((cell) => cell.bind.startsWith('pdf:'))).toBe(true);
  });

  test('parses HTML placeholders', () => {
    const source = Buffer.from(
      '<p>{{employerName}}</p>{{#each employees}}<span>{{employeeNo}}</span>{{/each}}',
      'utf8',
    );
    const parsed = parseTemplateFile(source, 'form5-general.html', GUJARAT_SLABS);
    expect(parsed.kind).toBe('html');
    expect(parsed.placeholders).toEqual(
      expect.arrayContaining(['employerName', 'employeeNo']),
    );
  });
});
