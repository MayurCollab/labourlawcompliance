/**
 * Diagnose why Form 5 employee lists are empty for given client codes.
 * Usage: node scripts/diagnoseClientEmployees.mjs C0235 C0033 C0576
 */
import 'dotenv/config';
import mongoose from 'mongoose';

import { normalizePhyCode } from '../src/modules/uploads/masterParse.js';
import {
  employeeMatchesClient,
  employeesForClientLocation,
} from '../src/modules/filings/employeeListForFiling.js';

const codes = process.argv.slice(2).map((c) => c.trim().toUpperCase());
if (!codes.length) {
  console.error('Usage: node scripts/diagnoseClientEmployees.mjs C0235 C0033 ...');
  process.exit(1);
}

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const clients = await db
  .collection('clients')
  .find({ clientCode: { $in: codes }, isDeleted: { $ne: true } })
  .project({
    clientCode: 1,
    companyName: 1,
    phyCode: 1,
    includeEmployeesOnForm5: 1,
    location: 1,
  })
  .toArray();

const byCode = new Map(clients.map((c) => [c.clientCode, c]));

for (const code of codes) {
  console.log('\n==========', code, '==========');
  const client = byCode.get(code);
  if (!client) {
    console.log('CLIENT NOT FOUND in DB (or soft-deleted)');
    continue;
  }

  console.log({
    id: String(client._id),
    companyName: client.companyName,
    phyCode: client.phyCode,
    phyNormalized: normalizePhyCode(client.phyCode),
    includeEmployeesOnForm5: client.includeEmployeesOnForm5,
    location: client.location,
  });

  const filings = await db
    .collection('filings')
    .find({
      $or: [{ client: client._id }, { clientCode: code }],
      isDeleted: { $ne: true },
    })
    .project({
      period: 1,
      periodLabel: 1,
      generateStatus: 1,
      clientCode: 1,
      'computation.employeeCount': 1,
      'computation.unmatchedExcluded': 1,
      'computation.taxable': 1,
      'computation.exempt': 1,
      generatedFile: 1,
    })
    .sort({ period: -1 })
    .limit(8)
    .toArray();

  console.log(
    'Recent filings:',
    filings.map((f) => ({
      period: f.period,
      generateStatus: f.generateStatus,
      employeeCount: f.computation?.employeeCount,
      unmatchedExcluded: f.computation?.unmatchedExcluded,
      hasGeneratedFile: Boolean(f.generatedFile?.key || f.generatedFile?.path),
    })),
  );

  const periods = [...new Set(filings.map((f) => f.period).filter(Boolean))];
  if (!periods.length) {
    // Still check any employees for this client
    periods.push(null);
  }

  for (const period of periods.length ? periods : [null]) {
    const or = [{ client: client._id }, { clientCode: code }];
    const phy = normalizePhyCode(client.phyCode);
    if (phy) or.push({ phyCode: phy }, { phyCode: client.phyCode });

    const filter = {
      isDeleted: { $ne: true },
      $or: or,
    };
    if (period) filter.period = period;

    const employees = await db
      .collection('employees')
      .find(filter)
      .project({
        employeeNo: 1,
        employeeName: 1,
        clientCode: 1,
        client: 1,
        phyCode: 1,
        period: 1,
        unmatched: 1,
        ptGross: 1,
        locationName: 1,
      })
      .limit(200)
      .toArray();

    const shapedClient = {
      id: String(client._id),
      _id: client._id,
      clientCode: client.clientCode,
      phyCode: client.phyCode,
      includeEmployeesOnForm5: client.includeEmployeesOnForm5,
    };

    const matched = employees.filter((e) => employeeMatchesClient(e, shapedClient));
    const unmatchedFlag = employees.filter((e) => e.unmatched === true);
    const listed =
      client.includeEmployeesOnForm5 === false
        ? []
        : employeesForClientLocation({
            employees,
            client: shapedClient,
            period: period || undefined,
            slabs: [],
          });

    // Also count salary rows that have this code but failed the broad $or somehow
    const byCodeOnly = period
      ? await db.collection('employees').countDocuments({
          clientCode: code,
          period,
          isDeleted: { $ne: true },
        })
      : await db.collection('employees').countDocuments({
          clientCode: code,
          isDeleted: { $ne: true },
        });

    const unmatchedWithCode = period
      ? await db.collection('employees').countDocuments({
          clientCode: code,
          period,
          unmatched: true,
          isDeleted: { $ne: true },
        })
      : await db.collection('employees').countDocuments({
          clientCode: code,
          unmatched: true,
          isDeleted: { $ne: true },
        });

    console.log(
      period ? `\n--- period ${period} ---` : '\n--- all periods (no filings) ---',
      {
        loadedByFilter: employees.length,
        unmatchedAmongLoaded: unmatchedFlag.length,
        employeeMatchesClientTrue: matched.length,
        form5ListedCount: listed.length,
        rowsWithClientCodeOnly: byCodeOnly,
        unmatchedRowsWithThisCode: unmatchedWithCode,
        sampleUnmatched: unmatchedFlag.slice(0, 5).map((e) => ({
          emp: e.employeeNo,
          name: e.employeeName,
          clientCode: e.clientCode,
          client: e.client ? String(e.client) : null,
          phyCode: e.phyCode,
          unmatched: e.unmatched,
        })),
        sampleMatched: matched.slice(0, 5).map((e) => ({
          emp: e.employeeNo,
          name: e.employeeName,
          clientCode: e.clientCode,
          phyCode: e.phyCode,
          unmatched: e.unmatched,
        })),
      },
    );
  }
}

// Global: any salary for these codes across periods
console.log('\n========== SUMMARY ACROSS ALL PERIODS ==========');
for (const code of codes) {
  const total = await db.collection('employees').countDocuments({
    clientCode: code,
    isDeleted: { $ne: true },
  });
  const unmatched = await db.collection('employees').countDocuments({
    clientCode: code,
    unmatched: true,
    isDeleted: { $ne: true },
  });
  const matched = await db.collection('employees').countDocuments({
    clientCode: code,
    unmatched: { $ne: true },
    isDeleted: { $ne: true },
  });
  const periods = await db
    .collection('employees')
    .aggregate([
      { $match: { clientCode: code, isDeleted: { $ne: true } } },
      { $group: { _id: '$period', total: { $sum: 1 }, unmatched: { $sum: { $cond: ['$unmatched', 1, 0] } } } },
      { $sort: { _id: -1 } },
    ])
    .toArray();
  console.log(code, { total, matched, unmatched, byPeriod: periods });
}

await mongoose.disconnect();
