/**
 * Offline verify: MasterSheet parse, Excel template fill (+ optional LibreOffice PDF),
 * bundled HTML fill + Puppeteer PDF. Writes samples under backend/uploads/.
 *
 * Usage:
 *   npm run verify:form5
 *   node scripts/verifyForm5Flow.mjs [master.xlsx] [Form5_Template.xlsx]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GUJARAT_DEFAULT_SLABS } from '../src/modules/ptSlabs/ptSlabs.constants.js';
import {
  buildComputationFromMaster,
  buildForm5Values,
} from '../src/modules/filings/form5Values.js';
import { convertXlsxBufferToPdf, isLibreOfficeAvailable } from '../src/modules/filings/xlsxToPdf.js';
import {
  isChromiumAvailable,
  isPdfBuffer,
  renderForm5Pdf,
} from '../src/modules/filings/htmlToPdf.js';
import { readBundledTemplateBuffer } from '../src/templates/form5/readBundledTemplate.js';
import { fillTemplateBuffer } from '../src/modules/templates/templateFill.js';
import { parseTemplateFile } from '../src/modules/templates/templateParse.js';
import { parseMasterWorkbook } from '../src/modules/uploads/masterParse.js';

const masterPath =
  process.argv[2] ||
  'c:/Users/mayur/Downloads/MasterSheet All Clients.xlsx';
const templatePath =
  process.argv[3] ||
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../tests/fixtures/Form5_Templete.xlsx',
  );

const masterBuf = fs.readFileSync(masterPath);
const master = parseMasterWorkbook(masterBuf);
console.log('Master sheet:', master.selectedSheet, 'headerRow', master.headerRow);
console.log(
  'Master mapping keys:',
  Object.entries(master.mapping)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${v}`)
    .join(', '),
);
console.log('Preview rows:', master.previewRows?.length);

const templateBuf = fs.readFileSync(templatePath);
const parsed = parseTemplateFile(templateBuf, 'Form5_Templete.xlsx', [
  ...GUJARAT_DEFAULT_SLABS,
]);
console.log('Template cells:', parsed.cells.length);
console.log('Mapped scalars:', parsed.mapping.scalars);
const top = parsed.mapping.slabs.find((s) => s.salaryFrom === 12000);
console.log('Top slab binds:', top?.binds);

const computation = buildComputationFromMaster(
  { ptAmount: 4400, period: '2026-07', periodLabel: 'Jul-2026', challanNo: '1814' },
  GUJARAT_DEFAULT_SLABS,
);
const values = buildForm5Values({
  filing: {
    clientCode: 'C0030',
    period: '2026-07',
    periodLabel: 'Jul-2026',
    ptAmount: 4400,
    challanNo: '1814',
    computation,
  },
  client: {
    draftName: 'SMFG India Credit Co. Ltd.',
    companyName: 'SMFG India Credit Co. Ltd. [654]',
    rcNumber: 'PRN014000571',
    address: 'Anand',
    location: { name: 'Anand' },
    signatoryName: 'Dipen C Shah',
  },
  settings: { signatoryName: '' },
  generatedAt: new Date('2026-08-26T06:00:00.000Z'),
});

const filled = await fillTemplateBuffer({
  buffer: templateBuf,
  kind: 'excel',
  mapping: parsed.mapping,
  values,
});
console.log('Filled xlsx bytes:', filled.length);

const lo = await isLibreOfficeAvailable();
console.log('LibreOffice available:', lo);
if (lo) {
  try {
    const pdf = await convertXlsxBufferToPdf(filled, 'verify_C0030_Anand');
    const out = path.join(process.cwd(), 'uploads', 'verify_Form5.pdf');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, pdf);
    console.log('Wrote PDF:', out, 'bytes', pdf.length);
  } catch (error) {
    console.error('PDF convert failed:', error.message);
    process.exitCode = 1;
  }
} else {
  console.log(
    'Skip PDF convert — install LibreOffice and set LIBREOFFICE_PATH to verify PDF output.',
  );
}

try {
  const htmlBuf = await readBundledTemplateBuffer('form5-general');
  const htmlFilled = await fillTemplateBuffer({
    buffer: htmlBuf,
    kind: 'html',
    values,
  });
  console.log('Filled HTML bytes:', htmlFilled.length);
  const chromium = await isChromiumAvailable();
  console.log('Chromium available:', chromium);
  if (chromium) {
    const htmlPdf = await renderForm5Pdf({
      html: htmlFilled.toString('utf8'),
    });
    if (!isPdfBuffer(htmlPdf)) {
      throw new Error('Bundled HTML did not render to a PDF');
    }
    const htmlOut = path.join(process.cwd(), 'uploads', 'verify_Form5_html.pdf');
    fs.mkdirSync(path.dirname(htmlOut), { recursive: true });
    fs.writeFileSync(htmlOut, htmlPdf);
    console.log('Wrote HTML PDF:', htmlOut, 'bytes', htmlPdf.length);
  } else {
    console.log('Skip HTML PDF — Puppeteer Chromium is not available.');
  }
} catch (error) {
  console.error('HTML Form 5 PDF verify failed:', error.message);
  process.exitCode = 1;
}
