import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';

import Client from '../../src/modules/clients/client.model.js';
import Filing from '../../src/modules/filings/filing.model.js';
import storage from '../../src/storage/index.js';
import * as uploadsRepository from '../../src/modules/uploads/uploads.repository.js';
import * as uploadsService from '../../src/modules/uploads/uploads.service.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { createVerifiedUser, seedRbac } from '../helpers/fixtures.js';
import { buildMasterWorkbookBuffer } from '../helpers/masterSheet.js';

const row = (clientCode, company, location, month = 'Jul-2026', extra = {}) => [
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
  month,
  '',
  '',
  '',
  '',
  '',
];

describe('MasterSheet ingest upsert', () => {
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
  });

  const uploadAndImport = async (rows) => {
    const buffer = buildMasterWorkbookBuffer(rows);
    const created = await uploadsService.createUpload(
      {
        kind: 'master',
        file: {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          originalname: 'MasterSheet.xlsx',
        },
      },
      actor.id,
    );

    const result = await uploadsService.importUpload(
      created.id,
      { sheetName: created.parse.selectedSheet, mapping: created.parse.mapping },
      actor.id,
    );

    return { created, result };
  };

  test('inserts clients and filing stubs, re-upload updates, missing rows are kept', async () => {
    const first = await uploadAndImport([
      row('C0001', 'Acer India Pvt. Ltd.', 'Ahmedabad'),
      row('C0099', 'SMFG India Credit Co. Ltd. [83]', 'Anand', 'Jul-2026', {
        rcNumber: 'PRC999',
        fundCode: 'G0099',
      }),
    ]);

    expect(first.result.report.inserted).toBe(2);
    expect(first.result.report.filings.inserted).toBe(2);
    expect(first.result.report.skipped).toEqual([]);

    const acer = await Client.findOne({ clientCode: 'C0001' });
    const smfg = await Client.findOne({ clientCode: 'C0099' });
    expect(acer.companyName).toBe('Acer India Pvt. Ltd.');
    expect(smfg.phyCode).toBe('0083');

    const second = await uploadAndImport([
      row('C0001', 'Acer India Private Limited', 'Ahmedabad', 'Jul-2026', {
        ptAmount: 400,
        challanNo: 'CH-1',
      }),
      row('C0100', 'New Client LLP', 'Surat'),
    ]);

    expect(second.result.report.inserted).toBe(1);
    expect(second.result.report.updated).toBe(1);

    const clients = await Client.find().sort({ clientCode: 1 });
    expect(clients.map((client) => client.clientCode)).toEqual([
      'C0001',
      'C0099',
      'C0100',
    ]);
    expect(clients[0].companyName).toBe('Acer India Private Limited');

    const filings = await Filing.find().sort({ clientCode: 1 });
    expect(filings).toHaveLength(3);
    const acerFiling = filings.find((filing) => filing.clientCode === 'C0001');
    expect(acerFiling.period).toBe('2026-07');
    expect(acerFiling.ptAmount).toBe(400);
    expect(acerFiling.challanNo).toBe('CH-1');

    const kept = filings.find((filing) => filing.clientCode === 'C0099');
    expect(kept).toBeTruthy();

    const firstStored = await uploadsRepository.findUploadByIdWithPath(
      first.created.id,
    );
    const secondStored = await uploadsRepository.findUploadByIdWithPath(
      second.created.id,
    );
    await storage.deleteFile(firstStored.storedPath);
    await storage.deleteFile(secondStored.storedPath);
  });

  test('skipped blank client code is in the report and error workbook', async () => {
    const { created, result } = await uploadAndImport([
      row('C0001', 'Acer India Pvt. Ltd.', 'Ahmedabad'),
      row('', 'Blank Code LLP', 'Surat'),
    ]);

    expect(result.report.inserted).toBe(1);
    expect(result.report.skipped).toHaveLength(1);
    expect(result.report.skipped[0].reason).toMatch(/client code/i);

    const clients = await Client.find();
    expect(clients.map((client) => client.clientCode)).toEqual(['C0001']);

    const errors = await uploadsService.downloadImportErrors(created.id);
    expect(errors.filename).toBe('MasterSheet_errors.xlsx');

    const stored = await uploadsRepository.findUploadByIdWithPath(created.id);
    await storage.deleteFile(stored.storedPath);
  });
});
