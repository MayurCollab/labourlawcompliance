import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from '@jest/globals';

import Client from '../../src/modules/clients/client.model.js';
import * as clientsService from '../../src/modules/clients/clients.service.js';
import * as uploadsRepository from '../../src/modules/uploads/uploads.repository.js';
import * as uploadsService from '../../src/modules/uploads/uploads.service.js';
import storage from '../../src/storage/index.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { createVerifiedUser, seedRbac } from '../helpers/fixtures.js';
import { buildClientMasterWorkbookBuffer } from '../helpers/clientMasterSheet.js';

describe('Client-Master address ingest', () => {
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
    const buffer = buildClientMasterWorkbookBuffer(rows);
    const created = await uploadsService.createUpload(
      {
        kind: 'clientMaster',
        file: {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          originalname: 'Client - Master.xlsx',
        },
      },
      actor.id,
    );

    const result = await uploadsService.importUpload(
      created.id,
      {
        sheetName: created.parse.selectedSheet,
        mapping: created.parse.mapping,
      },
      actor.id,
    );

    return { created, result };
  };

  test('creates a client with address and RC, then updates on re-upload', async () => {
    const first = await uploadAndImport();
    expect(first.result.report.inserted).toBe(1);
    expect(first.created.parse.rowCount).toBe(1);
    expect(first.created.parse.mapping.clientCode).toBe(0);
    expect(first.created.parse.mapping.address).toBe(5);
    expect(first.created.parse.mapping.rcNumber).toBe(7);

    const created = await Client.findOne({ clientCode: 'C0039' });
    expect(created.companyName).toBe('SMFG India Credit Co. Ltd. [534]');
    expect(created.phyCode).toBe('0534');
    expect(created.address).toContain('Sopan Complex');
    expect(created.rcNumber).toBe('PRC050000751');
    expect(created.includeEmployeesOnForm5).toBe(true);

    const second = await uploadAndImport([
      [
        'C0039',
        'SGC',
        'SMFG India Credit Co. Ltd. [534]',
        'Bhavnagar',
        'SMFG - CREDIT',
        'Updated address, Bhavnagar',
        'PEC050009559',
        'PRC050000751',
        '',
      ],
    ]);
    expect(second.result.report.updated).toBe(1);

    const updated = await Client.findOne({ clientCode: 'C0039' });
    expect(updated.address).toBe('Updated address, Bhavnagar');

    const firstStored = await uploadsRepository.findUploadByIdWithPath(
      first.created.id,
    );
    const secondStored = await uploadsRepository.findUploadByIdWithPath(
      second.created.id,
    );
    await storage.deleteFile(firstStored.storedPath);
    await storage.deleteFile(secondStored.storedPath);
  });

  test('fills address onto an existing MasterSheet client', async () => {
    await clientsService.createClient(
      {
        clientCode: 'C0039',
        companyName: 'SMFG India Credit Co. Ltd. [534]',
        locationName: 'Bhavnagar',
        phyCode: '0534',
      },
      actor.id,
    );

    const { created, result } = await uploadAndImport();
    expect(result.report.updated).toBe(1);

    const client = await Client.findOne({ clientCode: 'C0039' });
    expect(client.address).toContain('Sopan Complex');
    expect(client.rcNumber).toBe('PRC050000751');

    const stored = await uploadsRepository.findUploadByIdWithPath(created.id);
    await storage.deleteFile(stored.storedPath);
  });
});
