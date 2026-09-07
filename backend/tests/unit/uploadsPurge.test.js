import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';

import {
  buildSalaryPurgeFilter,
  purgeClientMasterData,
  purgeMasterData,
  purgeSalaryData,
} from '../../src/modules/uploads/uploadsPurge.js';
import Client from '../../src/modules/clients/client.model.js';
import Employee from '../../src/modules/employees/employee.model.js';
import Filing from '../../src/modules/filings/filing.model.js';
import Location from '../../src/modules/locations/location.model.js';
import { PURGE_CONFIRMATIONS } from '../../src/modules/uploads/uploads.constants.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';

describe('uploadsPurge', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  test('buildSalaryPurgeFilter scopes by period only when no company filter', async () => {
    const filter = await buildSalaryPurgeFilter({ period: '2026-07' });
    expect(filter).toEqual({ period: '2026-07' });
  });

  test('buildSalaryPurgeFilter matches company by legal name and phy code', async () => {
    const location = await Location.create({ name: 'Anand', nameKey: 'anand' });
    await Client.create([
      {
        clientCode: 'C0099',
        companyName: 'SMFG India Credit Co. Ltd. [83]',
        location: location.id,
        phyCode: '0083',
        fundCode: 'G0099',
      },
      {
        clientCode: 'C0001',
        companyName: 'Acer India Pvt. Ltd.',
        location: location.id,
        phyCode: '0001',
        fundCode: 'G0001',
      },
    ]);

    const filter = await buildSalaryPurgeFilter({
      period: '2026-07',
      companyName: 'SMFG India Credit Co. Ltd.',
    });

    expect(filter.period).toBe('2026-07');
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ client: expect.any(Object) }),
        { phyCode: { $in: ['0083'] } },
      ]),
    );
  });

  test('purgeMasterData soft-deletes clients and filings but keeps employees', async () => {
    const location = await Location.create({ name: 'Anand', nameKey: 'anand' });
    const client = await Client.create({
      clientCode: 'C0099',
      companyName: 'SMFG India Credit Co. Ltd.',
      location: location.id,
      phyCode: '0083',
    });
    await Filing.create({
      client: client.id,
      clientCode: 'C0099',
      period: '2026-07',
    });
    await Employee.create({
      employeeNo: 'E1001',
      phyCode: '0083',
      period: '2026-07',
      client: client.id,
      clientCode: 'C0099',
      employeeName: 'Asha Shah',
    });

    const result = await purgeMasterData(
      { confirmation: PURGE_CONFIRMATIONS.MASTER },
      client.id,
    );
    expect(result.clientsRemoved).toBe(1);
    expect(result.filingsRemoved).toBe(1);
    expect(await Client.countDocuments()).toBe(0);
    expect(await Filing.countDocuments()).toBe(0);
    expect(await Employee.countDocuments()).toBe(1);
  });

  test('purgeSalaryData removes employees for a period only', async () => {
    const location = await Location.create({ name: 'Anand', nameKey: 'anand' });
    const client = await Client.create({
      clientCode: 'C0099',
      companyName: 'SMFG India Credit Co. Ltd. [83]',
      location: location.id,
      phyCode: '0083',
      fundCode: 'G0099',
    });
    await Employee.create([
      {
        employeeNo: 'E1001',
        phyCode: '0083',
        period: '2026-07',
        client: client.id,
        clientCode: 'C0099',
        employeeName: 'Asha Shah',
      },
      {
        employeeNo: 'E1002',
        phyCode: '0083',
        period: '2026-06',
        client: client.id,
        clientCode: 'C0099',
        employeeName: 'Old month',
      },
    ]);

    const result = await purgeSalaryData(
      {
        confirmation: PURGE_CONFIRMATIONS.SALARY,
        period: '2026-07',
        companyName: 'SMFG India Credit Co. Ltd.',
      },
      client.id,
    );
    expect(result.employeesRemoved).toBe(1);
    expect(await Employee.countDocuments()).toBe(1);
    expect(await Client.countDocuments()).toBe(1);
  });

  test('purgeClientMasterData clears address and RC but keeps clients', async () => {
    const location = await Location.create({ name: 'Anand', nameKey: 'anand' });
    await Client.create({
      clientCode: 'C0001',
      companyName: 'Acer India Pvt. Ltd.',
      location: location.id,
      address: '12 Ring Road',
      rcNumber: 'RC-100',
    });

    const result = await purgeClientMasterData(
      { confirmation: PURGE_CONFIRMATIONS.CLIENT_MASTER },
      location.id,
    );

    expect(result.addressesCleared).toBe(1);
    const client = await Client.findOne({ clientCode: 'C0001' });
    expect(client).toBeTruthy();
    expect(client.address).toBeNull();
    expect(client.rcNumber).toBeNull();
  });
});
