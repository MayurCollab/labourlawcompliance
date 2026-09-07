import { jest } from '@jest/globals';
import request from 'supertest';
import * as XLSX from 'xlsx';

jest.unstable_mockModule('../../src/email/emailService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../../src/modules/filings/xlsxToPdf.js', () => ({
  convertXlsxBufferToPdf: jest
    .fn()
    .mockResolvedValue(Buffer.from('%PDF-1.4\n%mock form5\n')),
  isLibreOfficeAvailable: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule('../../src/modules/filings/htmlToPdf.js', () => ({
  renderForm5Pdf: jest
    .fn()
    .mockResolvedValue(Buffer.from('%PDF-1.4\n%mock html form5\n')),
  isChromiumAvailable: jest.fn().mockResolvedValue(true),
  isPdfBuffer: (buffer) =>
    Buffer.isBuffer(buffer) &&
    buffer.slice(0, 5).toString('utf8') === '%PDF-',
}));

const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const {
  seedRbac,
  seedGujaratSlabs,
  createVerifiedUser,
  loginAs,
  authHeader,
} = await import('../helpers/fixtures.js');
const { buildMasterWorkbookBuffer } = await import('../helpers/masterSheet.js');
const { buildSalaryWorkbookBuffer } = await import('../helpers/salarySheet.js');
const { seedForm5BundledTemplates } = await import(
  '../../src/database/seeders/seedForm5Templates.js'
);
const Client = (await import('../../src/modules/clients/client.model.js'))
  .default;
const app = (await import('../../src/app.js')).default;

const masterRow = (clientCode, company, location, extra = {}) => [
  1,
  extra.status ?? 'G',
  '',
  clientCode,
  company,
  extra.draftName ?? '',
  location,
  extra.ptAmount ?? 200,
  '',
  '',
  extra.challanNo ?? '',
  '',
  extra.rcNumber ?? 'PRC016780178',
  '',
  extra.fundCode ?? 'G0001',
  extra.month ?? 'Jul-2026',
  '',
  '',
  '',
  '',
  '',
];

const salaryRow = (empNo, name, phy, extra = {}) => [
  1,
  empNo,
  name,
  extra.location ?? 'Anand',
  extra.state ?? 'Gujarat',
  extra.ptGross ?? 12478,
  phy,
  extra.pTax ?? 200,
];

const readBody = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const xlsxAttach = (buffer, filename) => ({
  filename,
  contentType:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

describe('Form 5 parse + generate HTTP', () => {
  let adminSession;

  beforeAll(async () => {
    await connectTestDb();
    await clearTestDb();
    const rbac =     await seedRbac();
    await seedGujaratSlabs();
    await seedForm5BundledTemplates();
    await createVerifiedUser({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'Password1',
      role: rbac.superAdmin.id,
    });
    adminSession = await loginAs(app, request, {
      email: 'admin@example.com',
      password: 'Password1',
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const auth = () => authHeader(adminSession.accessToken);

  const uploadWorkbook = async (kind, buffer, filename) => {
    const response = await request(app)
      .post('/api/v1/uploads')
      .set(auth())
      .field('kind', kind)
      .attach('file', buffer, xlsxAttach(buffer, filename));
    expect(response.status).toBe(201);
    return response.body.data.upload;
  };

  test('tiny fixture: import, keep on re-import, generate Form 5, activity, error Excel', async () => {
    const firstMaster = await uploadWorkbook(
      'master',
      buildMasterWorkbookBuffer([
        masterRow('C0001', 'Acer India Pvt. Ltd.', 'Ahmedabad'),
        masterRow('C0099', 'SMFG India Credit Co. Ltd. [83]', 'Anand', {
          rcNumber: 'PRC999',
          fundCode: 'G0099',
        }),
        masterRow('', 'Blank Code LLP', 'Surat'),
      ]),
      'MasterSheet.xlsx',
    );

    const imported = await request(app)
      .post(`/api/v1/uploads/${firstMaster.id}/import`)
      .set(auth())
      .send({
        sheetName: firstMaster.parse.selectedSheet,
        mapping: firstMaster.parse.mapping,
      });
    expect(imported.status).toBe(200);
    expect(imported.body.data.report.inserted).toBe(2);
    expect(imported.body.data.report.skipped).toHaveLength(1);

    const errors = await request(app)
      .get(`/api/v1/uploads/${firstMaster.id}/errors`)
      .set(auth())
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(errors.status).toBe(200);
    expect(errors.headers['content-disposition']).toMatch(
      /MasterSheet_errors\.xlsx/,
    );
    const errorBook = XLSX.read(errors.body, { type: 'buffer' });
    const skippedSheet = XLSX.utils.sheet_to_json(
      errorBook.Sheets.Skipped,
      { header: 1, raw: false, defval: '' },
    );
    expect(skippedSheet[1][1]).toMatch(/client code/i);

    const secondMaster = await uploadWorkbook(
      'master',
      buildMasterWorkbookBuffer([
        masterRow('C0001', 'Acer India Private Limited', 'Ahmedabad'),
      ]),
      'MasterSheet-update.xlsx',
    );
    const reimported = await request(app)
      .post(`/api/v1/uploads/${secondMaster.id}/import`)
      .set(auth())
      .send({
        sheetName: secondMaster.parse.selectedSheet,
        mapping: secondMaster.parse.mapping,
      });
    expect(reimported.status).toBe(200);

    const kept = await Client.findOne({ clientCode: 'C0099' });
    expect(kept).toBeTruthy();
    expect(kept.phyCode).toBe('0083');
    const acer = await Client.findOne({ clientCode: 'C0001' });
    expect(acer.companyName).toBe('Acer India Private Limited');

    const salary = await uploadWorkbook(
      'salary',
      buildSalaryWorkbookBuffer([
        salaryRow('E5101', 'Asha Shah', '0083'),
        salaryRow('E5102', 'Bina Patel', '0083', { ptGross: 15000 }),
        salaryRow('E5999', 'Orphan', '9999'),
      ]),
      'Salary-July-26.xlsx',
    );
    const salaryImport = await request(app)
      .post(`/api/v1/uploads/${salary.id}/import`)
      .set(auth())
      .send({
        sheetName: salary.parse.selectedSheet,
        mapping: salary.parse.mapping,
        period: '2026-07',
      });
    expect(salaryImport.status).toBe(200);
    expect(salaryImport.body.data.report.inserted).toBe(2);
    expect(salaryImport.body.data.report.unmatched).toHaveLength(1);

    const htmlPreview = await request(app)
      .get('/api/v1/templates/bundled/form5-general/preview')
      .set(auth())
      .buffer(true)
      .parse(readBody);
    expect(htmlPreview.status).toBe(200);
    expect(htmlPreview.headers['content-type']).toMatch(/html/i);
    expect(htmlPreview.body.toString('utf8')).toContain(
      'SMFG India Credit Co. Ltd.',
    );

    const filings = await request(app)
      .get('/api/v1/filings')
      .query({ period: '2026-07', search: 'C0099', limit: 20 })
      .set(auth());
    expect(filings.status).toBe(200);
    const filing = filings.body.data.filings.find(
      (row) => row.clientCode === 'C0099',
    );
    expect(filing).toBeTruthy();

    const computed = await request(app)
      .post(`/api/v1/filings/${filing.id}/compute`)
      .set(auth())
      .send({});
    expect(computed.status).toBe(200);
    expect(computed.body.data.filing.computation.totalA).toBe(400);
    expect(computed.body.data.filing.computation.employeeCount).toBe(2);

    const generated = await request(app)
      .post(`/api/v1/filings/${filing.id}/generate`)
      .set(auth())
      .send({});
    expect(generated.status).toBe(200);
    expect(generated.body.data.filing.generatedFile.filename).toMatch(
      /\.pdf$/i,
    );
    expect(generated.body.data.filing.generatedFile.mimetype).toMatch(/pdf/i);
    expect(generated.body.data.filing.generatedFile.templateCode).toBe(
      'form5-general',
    );

    const downloaded = await request(app)
      .get(`/api/v1/filings/${filing.id}/download`)
      .set(auth())
      .buffer(true)
      .parse(readBody);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['content-type']).toMatch(/pdf/i);
    expect(downloaded.headers['content-disposition']).toMatch(/\.pdf/i);
    expect(downloaded.body.slice(0, 5).toString('utf8')).toBe('%PDF-');

    const importActivity = await request(app)
      .get('/api/v1/activity')
      .query({ action: 'uploads.import', entityType: 'Upload', limit: 20 })
      .set(auth());
    expect(importActivity.status).toBe(200);
    expect(
      importActivity.body.data.entries.some(
        (entry) => entry.action === 'uploads.import',
      ),
    ).toBe(true);

    const filingActivity = await request(app)
      .get('/api/v1/activity')
      .query({ action: 'filings', entityType: 'Filing', limit: 20 })
      .set(auth());
    expect(filingActivity.status).toBe(200);
    const actions = filingActivity.body.data.entries.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['filings.compute', 'filings.generate']),
    );
  });

  test('filing detail, overrides, and bundled templates', async () => {
    const master = await uploadWorkbook(
      'master',
      buildMasterWorkbookBuffer([
        masterRow('C0100', 'Override Test Co. [100]', 'Anand', {
          rcNumber: 'PRC100',
          fundCode: 'G0100',
        }),
      ]),
      'MasterSheet-overrides.xlsx',
    );
    await request(app)
      .post(`/api/v1/uploads/${master.id}/import`)
      .set(auth())
      .send({
        sheetName: master.parse.selectedSheet,
        mapping: master.parse.mapping,
      });

    const salary = await uploadWorkbook(
      'salary',
      buildSalaryWorkbookBuffer([salaryRow('E2001', 'Override Employee', '0100')]),
      'Salary-overrides.xlsx',
    );
    await request(app)
      .post(`/api/v1/uploads/${salary.id}/import`)
      .set(auth())
      .send({
        sheetName: salary.parse.selectedSheet,
        mapping: salary.parse.mapping,
        period: '2026-07',
      });

    const bundled = await request(app)
      .get('/api/v1/templates/bundled')
      .set(auth());
    expect(bundled.status).toBe(200);
    expect(bundled.body.data.templates.length).toBeGreaterThanOrEqual(6);
    expect(
      bundled.body.data.templates.some((row) => row.code === 'form5-general'),
    ).toBe(true);

    const list = await request(app)
      .get('/api/v1/filings')
      .query({ period: '2026-07', search: 'C0100', limit: 5 })
      .set(auth());
    const filing = list.body.data.filings.find(
      (row) => row.clientCode === 'C0100',
    );
    expect(filing).toBeTruthy();

    const detail = await request(app)
      .get(`/api/v1/filings/${filing.id}`)
      .set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.data.filing.employeePreview).toBeTruthy();
    expect(detail.body.data.filing.employeePreview.totalEmployeeCount).toBe(1);
    expect(detail.body.data.filing.hasTemplate).toBe(true);

    const overrides = await request(app)
      .patch(`/api/v1/filings/${filing.id}/overrides`)
      .set(auth())
      .send({
        employerAddress: '123 Anand Road, Anand',
        signatoryName: 'Test Signatory',
        filingDate: '2026-07-31',
        additionalTaxPayable: 500,
      });
    expect(overrides.status).toBe(200);
    expect(overrides.body.data.filing.generateOverrides).toMatchObject({
      employerAddress: '123 Anand Road, Anand',
      signatoryName: 'Test Signatory',
      additionalTaxPayable: 500,
    });
    expect(overrides.body.data.filing.employeePreview?.totalEmployeeCount).toBe(
      1,
    );

    const computed = await request(app)
      .post(`/api/v1/filings/${filing.id}/compute`)
      .set(auth())
      .send({});
    expect(computed.status).toBe(200);
    expect(computed.body.data.filing.employeePreview?.employees).toHaveLength(1);

    const generated = await request(app)
      .post(`/api/v1/filings/${filing.id}/generate`)
      .set(auth())
      .send({ computeIfNeeded: true });
    expect(generated.status).toBe(200);
    expect(generated.body.data.filing.generatedFile.filename).toMatch(/\.pdf$/i);
  });
});
