import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../src/email/emailService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const {
  seedRbac,
  createVerifiedUser,
  loginAs,
  authHeader,
} = await import('../helpers/fixtures.js');
const { buildMasterWorkbookBuffer } = await import('../helpers/masterSheet.js');
const { buildSalaryWorkbookBuffer } = await import('../helpers/salarySheet.js');
const Client = (await import('../../src/modules/clients/client.model.js'))
  .default;
const Employee = (await import('../../src/modules/employees/employee.model.js'))
  .default;
const Filing = (await import('../../src/modules/filings/filing.model.js'))
  .default;
const { PURGE_CONFIRMATIONS } = await import(
  '../../src/modules/uploads/uploads.constants.js'
);
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

const xlsxAttach = (buffer, filename) => ({
  filename,
  contentType:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

describe('Upload purge HTTP', () => {
  let adminSession;

  beforeAll(async () => {
    await connectTestDb();
    await clearTestDb();
    const rbac = await seedRbac();
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

  const importMaster = async () => {
    const upload = await uploadWorkbook(
      'master',
      buildMasterWorkbookBuffer([
        masterRow('C0001', 'Acer India Pvt. Ltd.', 'Ahmedabad'),
        masterRow('C0099', 'SMFG India Credit Co. Ltd. [83]', 'Anand', {
          rcNumber: 'PRC999',
          fundCode: 'G0099',
        }),
      ]),
      'MasterSheet.xlsx',
    );
    const imported = await request(app)
      .post(`/api/v1/uploads/${upload.id}/import`)
      .set(auth())
      .send({
        sheetName: upload.parse.selectedSheet,
        mapping: upload.parse.mapping,
      });
    expect(imported.status).toBe(200);
    return imported.body.data.report;
  };

  const importSalary = async () => {
    const upload = await uploadWorkbook(
      'salary',
      buildSalaryWorkbookBuffer([
        salaryRow('E1001', 'Asha Shah', '0083'),
        salaryRow('E1002', 'Bina Patel', '0083', { ptGross: 15000 }),
      ]),
      'Salary-July-26.xlsx',
    );
    const imported = await request(app)
      .post(`/api/v1/uploads/${upload.id}/import`)
      .set(auth())
      .send({
        sheetName: upload.parse.selectedSheet,
        mapping: upload.parse.mapping,
        period: '2026-07',
      });
    expect(imported.status).toBe(200);
    return imported.body.data.report;
  };

  test('salary purge removes employees but keeps clients; re-import restores rows', async () => {
    await importMaster();
    await importSalary();

    expect(await Client.countDocuments()).toBe(2);
    expect(await Employee.countDocuments()).toBe(2);
    expect(await Filing.countDocuments()).toBe(2);

    const purged = await request(app)
      .post('/api/v1/uploads/purge/salary')
      .set(auth())
      .send({
        confirmation: PURGE_CONFIRMATIONS.SALARY,
        period: '2026-07',
      });
    expect(purged.status).toBe(200);
    expect(purged.body.data.employeesRemoved).toBe(2);

    expect(await Client.countDocuments()).toBe(2);
    expect(await Employee.countDocuments()).toBe(0);
    expect(await Filing.countDocuments()).toBe(2);

    const report = await importSalary();
    expect(report.inserted).toBe(2);
    expect(await Employee.countDocuments()).toBe(2);
  });

  test('master purge removes clients and filings but keeps employees', async () => {
    await importMaster();
    await importSalary();

    const purged = await request(app)
      .post('/api/v1/uploads/purge/master')
      .set(auth())
      .send({ confirmation: PURGE_CONFIRMATIONS.MASTER });
    expect(purged.status).toBe(200);
    expect(purged.body.data.clientsRemoved).toBe(2);
    expect(purged.body.data.filingsRemoved).toBe(2);

    expect(await Client.countDocuments()).toBe(0);
    expect(await Filing.countDocuments()).toBe(0);
    expect(await Employee.countDocuments()).toBe(2);
  });

  test('purge endpoints reject wrong confirmation phrase', async () => {
    const response = await request(app)
      .post('/api/v1/uploads/purge/master')
      .set(auth())
      .send({ confirmation: 'DELETE ALL' });
    expect(response.status).toBe(422);
  });
});
