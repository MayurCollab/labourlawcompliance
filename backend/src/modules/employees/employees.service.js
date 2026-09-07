import { sanitizeUserHtml } from '../../utils/sanitize.js';
import { normalizeClientCode } from '../clients/clients.constants.js';
import * as clientsRepository from '../clients/clients.repository.js';
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

const sameNumber = (left, right) => {
  if (left == null && right == null) return true;
  return Number(left) === Number(right);
};

const sameText = (left, right) => (left ?? null) === (right ?? null);

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
 * Upsert one employee-month row. PHY_CODE and Client code are optional.
 * Unmatched rows still insert (client null); rows absent from the file are kept.
 * Optional `cache` skips per-row employee finds and uses Map client matching.
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
  if (ptGross === null) {
    return { outcome: 'skipped', reason: 'Missing PT GROSS' };
  }

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
    pTax: fields.pTax === undefined ? undefined : parseAmount(fields.pTax),
    unmatched,
    unmatchedReason: unmatched && !omittedIdentity ? unmatchedReason : null,
    upload: uploadId ?? null,
  };

  const cacheKey = employeeCacheKey(employeeNo, phyCode, period);
  let existing =
    cache?.employeesByKey?.get(cacheKey) ??
    (await employeesRepository.findEmployeeByKey(employeeNo, phyCode, period));

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
      // Concurrent salary imports (or a partial prior run) can race the
      // unique (employeeNo, phyCode, period) index — treat as update.
      if (!isDuplicateKey(err)) throw err;
      existing = await employeesRepository.findEmployeeByKey(
        employeeNo,
        phyCode,
        period,
      );
      if (!existing) throw err;
      rememberEmployee(cache, existing);
    }
  }

  const nextPTax =
    payload.pTax === undefined ? existing.pTax : payload.pTax;

  const changed =
    String(existing.client ?? '') !== String(clientId ?? '') ||
    !sameText(existing.clientCode, clientCode) ||
    !sameText(existing.employeeName, payload.employeeName) ||
    !sameText(existing.locationName, payload.locationName) ||
    !sameText(existing.state, payload.state) ||
    !sameNumber(existing.ptGross, payload.ptGross) ||
    !sameNumber(existing.pTax, nextPTax) ||
    existing.unmatched !== unmatched ||
    !sameText(existing.unmatchedReason, payload.unmatchedReason) ||
    !sameText(existing.periodLabel, payload.periodLabel);

  if (!changed) {
    rememberEmployee(cache, existing);
    return {
      outcome: reportUnmatched ? 'unmatched' : 'unchanged',
      employee: existing,
    };
  }

  existing.client = clientId;
  existing.clientCode = clientCode;
  existing.employeeName = payload.employeeName;
  existing.locationName = payload.locationName;
  existing.state = payload.state;
  existing.ptGross = payload.ptGross;
  if (payload.pTax !== undefined) existing.pTax = payload.pTax;
  existing.unmatched = unmatched;
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

  let rematched = 0;
  const pending = [];
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
    employee.client = client.id || client._id;
    employee.clientCode = client.clientCode;
    employee.unmatched = false;
    employee.unmatchedReason = null;
    employee.updatedBy = actorId;
    pending.push(employeesRepository.saveEmployee(employee));
    rematched += 1;
  }

  const chunkSize = 50;
  for (let i = 0; i < pending.length; i += chunkSize) {
    await Promise.all(pending.slice(i, i + chunkSize));
  }

  return rematched;
};
