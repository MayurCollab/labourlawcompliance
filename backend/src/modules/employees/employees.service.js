import { sanitizeUserHtml } from '../../utils/sanitize.js';
import { normalizeClientCode } from '../clients/clients.constants.js';
import * as clientsRepository from '../clients/clients.repository.js';
import { periodToDate, resolvePTax } from '../filings/ptCompute.js';
import * as ptSlabsService from '../ptSlabs/ptSlabs.service.js';
import {
  employeeCacheKey,
  rememberEmployee,
} from '../uploads/importCache.js';
import {
  legalCompanyName,
  normalizePhyCode,
  parseAmount,
  stringifyCell,
} from '../uploads/masterParse.js';
import { toEmployeeDto, toEmployeeListDto } from './employees.dto.js';
import * as employeesRepository from './employees.repository.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const blankToNull = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = sanitizeUserHtml(String(value).trim());
  return cleaned === '' ? null : cleaned;
};

const isDuplicateKey = (err) => err?.code === 11000;

export const listEmployees = async (query) => {
  const {
    page,
    limit,
    search,
    period,
    clientId,
    phyCode,
    unmatched,
    sortBy,
    sortOrder,
  } = query;

  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ employeeNo: regex }, { employeeName: regex }];
  }
  if (period) filter.period = period;
  if (clientId) filter.client = clientId;
  if (phyCode) {
    const normalized = normalizePhyCode(phyCode);
    if (normalized) filter.phyCode = normalized;
  }
  if (unmatched === true || unmatched === false) {
    filter.unmatched = unmatched;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [employees, total] = await Promise.all([
    employeesRepository.findEmployees(filter, { sort, skip, limit }),
    employeesRepository.countEmployees(filter),
  ]);

  return {
    employees: toEmployeeListDto(employees),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

/**
 * Pick the Client for a salary PHY_CODE. Optional legal-company filter
 * (MasterSheet names with [83] stripped) narrows SMFG vs Acer, etc.
 */
export const matchClientByPhyCode = (clients, phyCode, companyName = '') => {
  const normalized = normalizePhyCode(phyCode);
  if (!normalized) {
    return { client: null, reason: 'Missing PHY_CODE' };
  }

  const byPhy = clients.filter(
    (client) => normalizePhyCode(client.phyCode) === normalized,
  );
  const wanted = legalCompanyName(companyName).toLowerCase();
  const scoped = wanted
    ? byPhy.filter(
        (client) =>
          legalCompanyName(client.companyName).toLowerCase() === wanted,
      )
    : byPhy;

  if (scoped.length === 1) {
    return { client: scoped[0], reason: null };
  }
  if (scoped.length > 1) {
    return {
      client: null,
      reason: `PHY_CODE ${normalized} matches ${scoped.length} clients`,
    };
  }
  if (byPhy.length > 0 && wanted) {
    return {
      client: null,
      reason: `PHY_CODE ${normalized} is not on ${legalCompanyName(companyName)}`,
    };
  }
  return {
    client: null,
    reason: `No client with PHY_CODE ${normalized}`,
  };
};

/**
 * Prefer an explicit salary Client code (C0039), then PHY_CODE.
 * Pass `clientsByCode` Map for O(1) code lookups during import.
 */
export const matchClientForSalaryRow = (
  clients,
  { phyCode, clientCode, companyName = '' } = {},
  clientsByCode = null,
) => {
  const code = normalizeClientCode(clientCode);
  if (code) {
    if (clientsByCode instanceof Map) {
      const byCode = clientsByCode.get(code);
      if (byCode) return { client: byCode, reason: null };
      return { client: null, reason: `No client with code ${code}` };
    }

    const byCode = (clients || []).filter(
      (client) => normalizeClientCode(client.clientCode) === code,
    );
    if (byCode.length === 1) {
      return { client: byCode[0], reason: null };
    }
    if (byCode.length > 1) {
      return {
        client: null,
        reason: `Client ${code} matches ${byCode.length} records`,
      };
    }
    return { client: null, reason: `No client with code ${code}` };
  }

  return matchClientByPhyCode(clients, phyCode, companyName);
};

/**
 * Build a salary employee-month document from one sheet row.
 * Match key is (employeeNo, phyCode, period). Does not write to the DB.
 * PT GROSS is optional. P.Tax = slab rate from gross, or ₹200 when gross is blank.
 */
export const prepareSalaryUpsert = ({
  fields,
  period,
  periodLabel,
  clients,
  companyName,
  uploadId,
  cache = null,
  slabs = [],
}) => {
  const employeeNo = stringifyCell(fields.employeeNo);
  if (!employeeNo) {
    return { outcome: 'skipped', reason: 'Missing EMPNO' };
  }
  if (employeeNo.length > 64) {
    return { outcome: 'skipped', reason: 'EMPNO is too long' };
  }

  if (!period) {
    return { outcome: 'skipped', reason: 'Missing or unrecognised period' };
  }

  const ptGross = parseAmount(fields.ptGross);

  const rawPhy = normalizePhyCode(fields.phyCode);
  const rawClientCode = normalizeClientCode(fields.clientCode);
  const omittedIdentity = !rawPhy && !rawClientCode;

  const { client, reason: unmatchedReason } = matchClientForSalaryRow(
    clients,
    {
      phyCode: fields.phyCode,
      clientCode: fields.clientCode,
      companyName,
    },
    cache?.clientsByCode ?? null,
  );
  const unmatched = !client;
  const clientId = client ? client.id || client._id : null;
  const clientCode = client ? client.clientCode : rawClientCode || null;

  let phyCode = rawPhy;
  if (!phyCode && client) {
    phyCode = normalizePhyCode(client.phyCode);
  }
  phyCode = phyCode || '';

  const reportUnmatched = unmatched && !omittedIdentity;
  const cacheKey = employeeCacheKey(employeeNo, phyCode, period);
  const existing = cache?.employeesByKey?.get(cacheKey) ?? null;

  const pTax = resolvePTax(slabs, ptGross);

  const payload = {
    client: clientId,
    clientCode,
    employeeNo,
    employeeName: blankToNull(fields.employeeName) ?? null,
    phyCode,
    period,
    periodLabel: blankToNull(periodLabel) ?? null,
    locationName: blankToNull(fields.locationName) ?? null,
    state: blankToNull(fields.state) ?? null,
    ptGross,
    pTax,
    unmatched,
    unmatchedReason: unmatched && !omittedIdentity ? unmatchedReason : null,
    upload: uploadId ?? null,
  };

  return {
    outcome: 'ready',
    cacheKey,
    existing,
    payload,
    reportUnmatched,
    unmatchedReason,
  };
};

/**
 * Upsert one employee-month row by unique key only, then replace the full row.
 * PHY_CODE and Client code are optional. Unmatched rows still insert (client null).
 */
export const upsertFromSalaryRow = async ({
  fields,
  period,
  periodLabel,
  clients,
  companyName,
  uploadId,
  actorId,
  cache = null,
  slabs = null,
}) => {
  const resolvedSlabs =
    slabs ??
    (await ptSlabsService.listEffectiveSlabs(
      periodToDate(period) || new Date(),
    ));

  const prepared = prepareSalaryUpsert({
    fields,
    period,
    periodLabel,
    clients,
    companyName,
    uploadId,
    cache,
    slabs: resolvedSlabs,
  });

  if (prepared.outcome === 'skipped') {
    return { outcome: 'skipped', reason: prepared.reason };
  }

  const { payload, reportUnmatched, unmatchedReason, cacheKey } = prepared;
  let existing =
    prepared.existing ??
    (await employeesRepository.findEmployeeByKey(
      payload.employeeNo,
      payload.phyCode,
      payload.period,
    ));

  if (!existing) {
    try {
      const employee = await employeesRepository.createEmployee({
        ...payload,
        pTax: payload.pTax ?? null,
        createdBy: actorId,
      });
      rememberEmployee(cache, employee);
      return {
        outcome: reportUnmatched ? 'unmatched' : 'inserted',
        reason: reportUnmatched ? unmatchedReason : undefined,
        employee,
      };
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      existing = await employeesRepository.findEmployeeByKey(
        payload.employeeNo,
        payload.phyCode,
        payload.period,
      );
      if (!existing) throw err;
      rememberEmployee(cache, existing);
    }
  }

  // Unique-key match → replace the full salary row (no field-by-field skip).
  existing.client = payload.client;
  existing.clientCode = payload.clientCode;
  existing.employeeName = payload.employeeName;
  existing.locationName = payload.locationName;
  existing.state = payload.state;
  existing.ptGross = payload.ptGross;
  existing.pTax = payload.pTax;
  existing.unmatched = payload.unmatched;
  existing.unmatchedReason = payload.unmatchedReason;
  existing.periodLabel = payload.periodLabel;
  existing.upload = uploadId ?? existing.upload;
  existing.updatedBy = actorId;
  await employeesRepository.saveEmployee(existing);
  rememberEmployee(cache, existing);

  return {
    outcome: reportUnmatched ? 'unmatched' : 'updated',
    reason: reportUnmatched ? unmatchedReason : undefined,
    employee: existing,
  };
};

/**
 * Match by unique (employeeNo, phyCode, period) and bulk-replace full rows.
 * Later duplicate keys in the same sheet win. Rows absent from the file are kept.
 */
export const bulkUpsertSalaryRows = async ({
  rows,
  period,
  periodLabel,
  clients,
  companyName,
  uploadId,
  actorId,
  cache,
  chunkSize = 500,
  onChunk,
  slabs = null,
}) => {
  const report = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
    unmatched: [],
  };

  const resolvedSlabs =
    slabs ??
    (await ptSlabsService.listEffectiveSlabs(
      periodToDate(period) || new Date(),
    ));

  /** @type {Map<string, object>} */
  const byKey = new Map();

  for (const { fields, excelRow } of rows) {
    const prepared = prepareSalaryUpsert({
      fields,
      period,
      periodLabel,
      clients,
      companyName,
      uploadId,
      cache,
      slabs: resolvedSlabs,
    });

    if (prepared.outcome === 'skipped') {
      report.skipped.push({ row: excelRow, reason: prepared.reason });
      continue;
    }

    byKey.set(prepared.cacheKey, { ...prepared, excelRow, fields });
  }

  const writeRows = [...byKey.values()];
  const ops = [];
  const meta = [];

  for (const row of writeRows) {
    const setDoc = {
      ...row.payload,
      updatedBy: actorId,
      updatedAt: new Date(),
    };

    if (row.existing?._id) {
      ops.push({
        updateOne: {
          filter: { _id: row.existing._id },
          update: { $set: setDoc },
        },
      });
      meta.push({ kind: 'update', row });
    } else {
      ops.push({
        updateOne: {
          filter: {
            employeeNo: row.payload.employeeNo,
            phyCode: row.payload.phyCode,
            period: row.payload.period,
            isDeleted: false,
          },
          update: {
            $set: setDoc,
            $setOnInsert: {
              createdBy: actorId,
              createdAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            },
          },
          upsert: true,
        },
      });
      meta.push({ kind: 'insert', row });
    }
  }

  let written = 0;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const opChunk = ops.slice(i, i + chunkSize);
    const metaChunk = meta.slice(i, i + chunkSize);
    if (opChunk.length) {
      await employeesRepository.bulkWriteEmployees(opChunk);
    }

    for (const item of metaChunk) {
      const { row } = item;
      if (row.reportUnmatched) {
        report.unmatched.push({
          row: row.excelRow,
          employeeNo: stringifyCell(row.fields.employeeNo),
          phyCode: stringifyCell(row.fields.phyCode),
          clientCode: stringifyCell(row.fields.clientCode),
          reason: row.unmatchedReason,
        });
      } else if (item.kind === 'insert') {
        report.inserted += 1;
      } else {
        report.updated += 1;
      }

      // Keep cache coherent for any follow-up work in the same request.
      if (row.existing) {
        Object.assign(row.existing, row.payload, { updatedBy: actorId });
        rememberEmployee(cache, row.existing);
      } else {
        rememberEmployee(cache, {
          ...row.payload,
          id: undefined,
          _id: undefined,
        });
      }
    }

    written += metaChunk.length;
    if (onChunk) {
      onChunk({
        written,
        writeTotal: ops.length,
        skipped: report.skipped.length,
        report,
      });
    }
  }

  if (!ops.length && onChunk) {
    onChunk({
      written: 0,
      writeTotal: 0,
      skipped: report.skipped.length,
      report,
    });
  }

  return report;
};

/**
 * After clients are saved, attach previously unmatched salary rows.
 */
export const rematchUnmatchedEmployees = async (actorId) => {
  const [clients, rows] = await Promise.all([
    clientsRepository.findAllCompact(),
    employeesRepository.findUnmatchedEmployees(),
  ]);
  if (!rows.length) return 0;

  const clientsByCode = new Map();
  for (const client of clients) {
    const code = normalizeClientCode(client.clientCode);
    if (code) clientsByCode.set(code, client);
  }

  const ops = [];
  for (const employee of rows) {
    const { client } = matchClientForSalaryRow(
      clients,
      {
        phyCode: employee.phyCode,
        clientCode: employee.clientCode,
      },
      clientsByCode,
    );
    if (!client) continue;
    ops.push({
      updateOne: {
        filter: { _id: employee._id },
        update: {
          $set: {
            client: client.id || client._id,
            clientCode: client.clientCode,
            unmatched: false,
            unmatchedReason: null,
            updatedBy: actorId,
          },
        },
      },
    });
  }

  const chunkSize = 500;
  for (let i = 0; i < ops.length; i += chunkSize) {
    await employeesRepository.bulkWriteEmployees(ops.slice(i, i + chunkSize));
  }

  return ops.length;
};
