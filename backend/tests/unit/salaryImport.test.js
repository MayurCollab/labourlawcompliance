import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from '@jest/globals';

import Client from '../../src/modules/clients/client.model.js';
import Employee from '../../src/modules/employees/employee.model.js';
import * as clientsService from '../../src/modules/clients/clients.service.js';
import * as employeesService from '../../src/modules/employees/employees.service.js';
import * as uploadsRepository from '../../src/modules/uploads/uploads.repository.js';
import * as uploadsService from '../../src/modules/uploads/uploads.service.js';
import storage from '../../src/storage/index.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { createVerifiedUser, seedRbac } from '../helpers/fixtures.js';
import { buildSalaryWorkbookBuffer } from '../helpers/salarySheet.js';

const salaryRow = (
  empNo,
  name,
  phy,
  extra = {},
) => [
  1,
  empNo,
  name,
  extra.location ?? 'Anand',
  extra.state ?? 'Gujarat',
  extra.ptGross ?? 12478,
  phy,
  extra.pTax ?? 200,
];

describe('Salary ingest upsert', () => {
  let actor;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    const rbac = await seedRbac();
    actor = await createVerifiedUser({
      email: 'admin@example.com',
      password: 'Password1',
      role: rbac.superAdmin.id,
    });
    await clientsService.createClient(
      {
        clientCode: 'C0099',
        companyName: 'SMFG India Credit Co. Ltd. [83]',
        locationName: 'Anand',
        phyCode: '0083',
      },
      actor.id,
    );
  });

  const uploadAndImport = async (rows, period = '2026-07') => {
    const buffer = buildSalaryWorkbookBuffer(rows);
    const created = await uploadsService.createUpload(
      {
        kind: 'salary',
        file: {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          originalname:
            'Salary Sheet July-26 SMFG Anand extra long name.xlsx',
        },
      },
      actor.id,
    );

    const result = await uploadsService.importUpload(
      created.id,
      {
        sheetName: created.parse.selectedSheet,
        mapping: created.parse.mapping,
        period,
        companyName: 'SMFG India Credit Co. Ltd.',
      },
      actor.id,
    );

    return { created, result };
  };

  test('inserts matched employees, keeps unmatched, re-upload updates, missing rows stay', async () => {
    const first = await uploadAndImport([
      salaryRow('E1001', 'Asha Shah', '0083'),
      salaryRow('E1002', 'Bina Patel', 83, { ptGross: 15000 }),
      salaryRow('E9999', 'Orphan', '9999'),
    ]);

    expect(first.result.report.inserted).toBe(2);
    expect(first.result.report.unmatched).toHaveLength(1);
    expect(first.result.report.unmatched[0].employeeNo).toBe('E9999');

    const matched = await Employee.find({ unmatched: false }).sort({
      employeeNo: 1,
    });
    expect(matched).toHaveLength(2);
    expect(matched[0].phyCode).toBe('0083');
    const client = await Client.findOne({ clientCode: 'C0099' });
    expect(String(matched[0].client)).toBe(String(client.id));

    const orphan = await Employee.findOne({ employeeNo: 'E9999' });
    expect(orphan.unmatched).toBe(true);
    expect(orphan.client).toBeNull();

    const second = await uploadAndImport([
      salaryRow('E1001', 'Asha Shah Updated', '0083', { ptGross: 20000 }),
      salaryRow('E2000', 'New Hire', '0083'),
    ]);

    expect(second.result.report.inserted).toBe(1);
    expect(second.result.report.updated).toBe(1);

    const employees = await Employee.find().sort({ employeeNo: 1 });
    expect(employees.map((row) => row.employeeNo)).toEqual([
      'E1001',
      'E1002',
      'E2000',
      'E9999',
    ]);
    expect(employees[0].employeeName).toBe('Asha Shah Updated');
    expect(employees[0].ptGross).toBe(20000);

    const firstStored = await uploadsRepository.findUploadByIdWithPath(
      first.created.id,
    );
    const secondStored = await uploadsRepository.findUploadByIdWithPath(
      second.created.id,
    );
    await storage.deleteFile(firstStored.storedPath);
    await storage.deleteFile(secondStored.storedPath);
  });

  test('recovers when two imports race the same employee key', async () => {
    const clients = await Client.find();
    const fields = {
      employeeNo: 'E5001',
      employeeName: 'Race Hire',
      phyCode: '0083',
      ptGross: 12000,
      pTax: 200,
    };
    const args = {
      fields,
      period: '2026-07',
      periodLabel: '2026-07',
      clients,
      companyName: 'SMFG India Credit Co. Ltd.',
      uploadId: null,
      actorId: actor.id,
    };

    const results = await Promise.all([
      employeesService.upsertFromSalaryRow(args),
      employeesService.upsertFromSalaryRow({
        ...args,
        fields: { ...fields, employeeName: 'Race Hire B', ptGross: 13000 },
      }),
    ]);

    expect(results.every((r) => ['inserted', 'updated', 'unchanged'].includes(r.outcome))).toBe(
      true,
    );
    expect(await Employee.countDocuments({ employeeNo: 'E5001' })).toBe(1);
  });

  test('matches salary rows by client code C0039 when PHY is absent', async () => {
    const target = await clientsService.createClient(
      {
        clientCode: 'C0039',
        companyName: 'SMFG India Credit Co. Ltd. [534]',
        locationName: 'Bhavnagar',
        phyCode: '0534',
      },
      actor.id,
    );

    const XLSX = await import('xlsx');
    const aoa = [
      ['Salary Sheet July-26'],
      [
        'SRNO',
        'EMPNO',
        'EMP_NAME',
        'LOCATION',
        'STATE',
        'PT GROSS',
        'PHY_CODE',
        'P_TAX',
        'Client',
      ],
      [1, '146632', 'HARSHAL BHATT', 'BHAVNAGAR', 'GUJARAT', 99432, '', 200, 'C0039'],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'OutPut');
    const withClient = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const created = await uploadsService.createUpload(
      {
        kind: 'salary',
        file: {
          buffer: withClient,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          originalname: 'SalarySheet All Employees.xlsx',
        },
      },
      actor.id,
    );

    expect(created.parse.mapping.clientCode).toBe(8);

    const result = await uploadsService.importUpload(
      created.id,
      {
        sheetName: created.parse.selectedSheet,
        mapping: created.parse.mapping,
        period: '2026-07',
      },
      actor.id,
    );

    expect(result.report.inserted).toBe(1);
    const employee = await Employee.findOne({ employeeNo: '146632' });
    expect(employee.clientCode).toBe('C0039');
    expect(String(employee.client)).toBe(String(target.id));
    expect(employee.phyCode).toBe('0534');
    expect(employee.unmatched).toBe(false);

    const stored = await uploadsRepository.findUploadByIdWithPath(created.id);
    await storage.deleteFile(stored.storedPath);
  });
});
