import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@jest/globals';

import { GUJARAT_DEFAULT_SLABS } from '../../src/modules/ptSlabs/ptSlabs.constants.js';
import { extractExcelMarks } from '../../src/modules/templates/excelMarks.js';
import { parseTemplateFile } from '../../src/modules/templates/templateParse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(
  __dirname,
  '../fixtures/Form5_Templete.xlsx',
);

describe('excelMarks / Form-5_Templete', () => {
  test('extracts yellow and sample value cells', () => {
    const buffer = fs.readFileSync(templatePath);
    const marks = extractExcelMarks(buffer);
    expect(marks.cells.length).toBeGreaterThan(5);
    expect(marks.cells.some((cell) => cell.colored)).toBe(true);
    expect(
      marks.cells.some((cell) => /jul-26/i.test(cell.value)),
    ).toBe(true);
    expect(
      marks.cells.some((cell) => /name of the employer/i.test(cell.value)),
    ).toBe(true);
  });

  test('auto-maps employer, period, totals, and 12k slab binds', () => {
    const buffer = fs.readFileSync(templatePath);
    const parsed = parseTemplateFile(buffer, 'Form5_Templete.xlsx', [
      ...GUJARAT_DEFAULT_SLABS,
    ]);

    expect(parsed.mapping.scalars.employerName).toBeTruthy();
    expect(parsed.mapping.scalars.periodMonthLabel).toBeTruthy();
    expect(parsed.mapping.scalars.totalA).toBeTruthy();
    expect(parsed.mapping.scalars.signatoryName).toBeTruthy();
    expect(parsed.mapping.scalars.place).toBeTruthy();
    expect(parsed.mapping.scalars.filingDate).toBeTruthy();

    const top = parsed.mapping.slabs.find((row) => row.salaryFrom === 12000);
    expect(top?.binds?.employeeCount || top?.binds?.taxableCount).toBeTruthy();
    expect(top?.binds?.taxAmount || parsed.mapping.scalars.totalA).toBeTruthy();
  });
});
