import { describe, expect, test } from '@jest/globals';

import {
  fillHtmlBuffer,
  fillHtmlTemplate,
  flattenValuesForHandlebars,
  formatForm5Value,
} from '../../src/modules/templates/htmlFill.js';

const sampleValues = {
  scalars: {
    formTitle: 'Form 5',
    employerName: 'SMFG India Credit Co. Ltd.',
    rcNumber: 'PRC016780178',
    periodMonthLabel: 'Jul-26',
    place: 'Anand',
    filingDate: '31/08/2026',
    totalA: 600,
    totalB: 0,
    interest: 0,
    totalPayable: 600,
  },
  slabs: [
    {
      salaryFrom: 12000,
      salaryTo: null,
      rate: 200,
      employeeCount: 3,
      taxAmount: 600,
    },
  ],
  employees: [
    {
      srNo: 1,
      employeeNo: 'E001',
      employeeName: 'Asha Shah',
      locationName: 'Anand',
      ptGross: 15000,
      pTax: 200,
    },
    {
      srNo: 2,
      employeeNo: 'E002',
      employeeName: 'Ravi Patel',
      locationName: 'Anand',
      ptGross: 18000,
      pTax: 200,
    },
  ],
};

describe('formatForm5Value', () => {
  test('zero with nilIfZero returns NIL', () => {
    expect(formatForm5Value(0, { nilIfZero: true })).toBe('NIL');
  });

  test('non-zero number passes through', () => {
    expect(formatForm5Value(600)).toBe(600);
  });
});

describe('flattenValuesForHandlebars', () => {
  test('spreads scalars to top level and keeps arrays', () => {
    const flat = flattenValuesForHandlebars(sampleValues);
    expect(flat.employerName).toBe('SMFG India Credit Co. Ltd.');
    expect(flat.slabs).toHaveLength(1);
    expect(flat.employees).toHaveLength(2);
    expect(flat.totalB).toBe('NIL');
    expect(flat.interest).toBe('NIL');
  });
});

describe('fillHtmlTemplate', () => {
  test('replaces scalar placeholders', async () => {
    const html = await fillHtmlTemplate(
      '<p>{{employerName}} · {{rcNumber}}</p>',
      sampleValues,
    );
    expect(html).toContain('SMFG India Credit Co. Ltd.');
    expect(html).toContain('PRC016780178');
  });

  test('renders slab loop', async () => {
    const html = await fillHtmlTemplate(
      `<ul>{{#each slabs}}<li>{{employeeCount}} @ {{rate}}</li>{{/each}}</ul>`,
      sampleValues,
    );
    expect(html).toContain('<li>3 @ 200</li>');
  });

  test('renders employee loop', async () => {
    const html = await fillHtmlTemplate(
      `<table>{{#each employees}}<tr><td>{{employeeNo}}</td><td>{{employeeName}}</td></tr>{{/each}}</table>`,
      sampleValues,
    );
    expect(html).toContain('E001');
    expect(html).toContain('Asha Shah');
    expect(html).toContain('E002');
  });

  test('salaryRange helper formats open-ended slab', async () => {
    const html = await fillHtmlTemplate(
      `{{#each slabs}}{{salaryRange this}}{{/each}}`,
      sampleValues,
    );
    expect(html).toContain('12000 and above');
  });
});

describe('fillHtmlBuffer', () => {
  test('returns UTF-8 buffer', async () => {
    const buffer = await fillHtmlBuffer(
      '<span>{{employerName}}</span>',
      sampleValues,
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString('utf8')).toContain('SMFG India Credit Co. Ltd.');
  });
});
