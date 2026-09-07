import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test, afterEach } from '@jest/globals';

import { fillHtmlTemplate } from '../../src/modules/templates/htmlFill.js';
import {
  clearBrowserLauncherForTests,
  isPdfBuffer,
  renderForm5Pdf,
  setBrowserLauncherForTests,
} from '../../src/modules/filings/htmlToPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, '../fixtures/form5-sample.html');

const sampleValues = {
  scalars: {
    formTitle: 'Form 5',
    employerName: 'SMFG India Credit Co. Ltd.',
    rcNumber: 'PRC016780178',
    periodMonthLabel: 'Jul-26',
    place: 'Anand',
    filingDate: '31/08/2026',
    totalA: 600,
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
  ],
};

const FAKE_PDF = Buffer.from('%PDF-1.4\n% mock form5 pdf\n');

const mockBrowser = () => ({
  connected: true,
  on: () => {},
  newPage: async () => ({
    setDefaultNavigationTimeout: () => {},
    setDefaultTimeout: () => {},
    setContent: async () => {},
    pdf: async () => FAKE_PDF,
    close: async () => {},
  }),
  close: async () => {},
});

afterEach(() => {
  clearBrowserLauncherForTests();
});

describe('isPdfBuffer', () => {
  test('detects PDF magic bytes', () => {
    expect(isPdfBuffer(FAKE_PDF)).toBe(true);
    expect(isPdfBuffer(Buffer.from('not a pdf'))).toBe(false);
  });
});

describe('renderForm5Pdf', () => {
  test('rejects empty HTML', async () => {
    await expect(renderForm5Pdf({ html: '  ' })).rejects.toMatchObject({
      message: expect.stringContaining('HTML content is required'),
    });
  });

  test('returns PDF buffer via mocked Chromium', async () => {
    setBrowserLauncherForTests(async () => mockBrowser());

    const template = fs.readFileSync(fixturePath, 'utf8');
    const html = await fillHtmlTemplate(template, sampleValues);
    const pdf = await renderForm5Pdf({ html });

    expect(isPdfBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(4);
  });
});

describe('renderForm5Pdf integration', () => {
  test('renders fixture HTML to PDF when Chromium is available', async () => {
    const { isChromiumAvailable } = await import(
      '../../src/modules/filings/htmlToPdf.js'
    );
    const available = await isChromiumAvailable();
    if (!available) {
      return;
    }

    const template = fs.readFileSync(fixturePath, 'utf8');
    const html = await fillHtmlTemplate(template, sampleValues);
    const pdf = await renderForm5Pdf({ html, timeoutMs: 90_000 });

    expect(isPdfBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
