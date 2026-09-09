import AppError from '../../utils/AppError.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import { toLocationNameKey } from '../locations/locations.constants.js';
import * as locationsService from '../locations/locations.service.js';
import {
  rememberClient,
  rememberLocation,
} from '../uploads/importCache.js';
import { extractPhyCode, legalCompanyName, normalizePhyCode } from '../uploads/masterParse.js';
import { CLIENTS_CODES, normalizeClientCode } from './clients.constants.js';
import { toClientDto, toClientListDto } from './clients.dto.js';
import { buildClientsWorkbook } from './clientsExport.js';
import * as clientsRepository from './clients.repository.js';

const CLIENT_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const blankToNull = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = sanitizeUserHtml(String(value).trim());
  return cleaned === '' ? null : cleaned;
};

const findClientOrFail = async (id) => {
  const client = await clientsRepository.findClientById(id);
  if (!client) {
    throw new AppError('Client not found', 404, {
      code: CLIENTS_CODES.CLIENT_NOT_FOUND,
    });
  }
  return client;
};

const assertCodeAvailable = async (clientCode, excludeId = null) => {
  const existing = await clientsRepository.findClientByCode(clientCode);
  if (existing && String(existing.id) !== String(excludeId)) {
    throw new AppError('A client with this code already exists', 409, {
      code: CLIENTS_CODES.CLIENT_CODE_IN_USE,
    });
  }
};

const buildClientListFilter = ({ search, locationId, fundCode }) => {
  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [
      { clientCode: regex },
      { companyName: regex },
      { rcNumber: regex },
      { fundCode: regex },
    ];
  }
  if (locationId) filter.location = locationId;
  if (fundCode) filter.fundCode = fundCode.trim();
  return filter;
};

const sortFromQuery = ({ sortBy, sortOrder }) => ({
  [sortBy]: sortOrder === 'asc' ? 1 : -1,
});

export const listClients = async (query) => {
  const { page, limit, sortBy, sortOrder } = query;
  const filter = buildClientListFilter(query);
  const skip = (page - 1) * limit;
  const sort = sortFromQuery({ sortBy, sortOrder });

  const [clients, total] = await Promise.all([
    clientsRepository.findClients(filter, { sort, skip, limit }),
    clientsRepository.countClients(filter),
  ]);

  return {
    clients: toClientListDto(clients),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

/**
 * Excel of matching clients (same filters as the list, no pagination).
 */
export const exportClients = async (query) => {
  const filter = buildClientListFilter(query);
  const sort = sortFromQuery(query);
  const clients = await clientsRepository.findClientsForExport(filter, {
    sort,
  });
  const file = buildClientsWorkbook(clients);

  await recordActivity({
    action: ACTIVITY_ACTIONS.CLIENT_EXPORT,
    entityType: ENTITY_TYPES.CLIENT,
    changes: { count: clients.length },
  });

  return file;
};

/**
 * Compact client + legal-company lists for salary company picker.
 */
export const listClientOptions = async () => {
  const clients = await clientsRepository.findAllCompact();
  const companies = new Map();

  for (const client of clients) {
    const name = legalCompanyName(client.companyName);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!companies.has(key)) {
      companies.set(key, { name, clientCount: 0, phyCodes: new Set() });
    }
    const group = companies.get(key);
    group.clientCount += 1;
    const phy = normalizePhyCode(client.phyCode);
    if (phy) group.phyCodes.add(phy);
  }

  return {
    clients: clients.map((client) => ({
      id: client.id,
      clientCode: client.clientCode,
      companyName: client.companyName,
      phyCode: client.phyCode,
      fundCode: client.fundCode,
      locationName: client.location?.name ?? null,
    })),
    companies: [...companies.values()]
      .map((group) => ({
        name: group.name,
        clientCount: group.clientCount,
        phyCodes: [...group.phyCodes].sort(),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
};

export const getClient = async (id) => {
  const client = await findClientOrFail(id);
  return toClientDto(client);
};

export const createClient = async (data, actorId) => {
  const clientCode = normalizeClientCode(data.clientCode);
  await assertCodeAvailable(clientCode);

  const { location } = await locationsService.findOrCreateByName(
    data.locationName,
    actorId,
  );

  const client = await clientsRepository.createClient({
    clientCode,
    companyName: sanitizeUserHtml(data.companyName),
    draftName: blankToNull(data.draftName) ?? null,
    location: location.id,
    authorityName: blankToNull(data.authorityName) ?? null,
    address: blankToNull(data.address) ?? null,
    rcNumber: blankToNull(data.rcNumber) ?? null,
    contactNumber: blankToNull(data.contactNumber) ?? null,
    fundCode: blankToNull(data.fundCode) ?? null,
    phyCode: blankToNull(data.phyCode) ?? null,
    status: blankToNull(data.status) ?? null,
    signatoryName: blankToNull(data.signatoryName) ?? null,
    includeEmployeesOnForm5:
      data.includeEmployeesOnForm5 === undefined
        ? true
        : Boolean(data.includeEmployeesOnForm5),
    createdBy: actorId,
  });

  await recordActivity({
    action: ACTIVITY_ACTIONS.CLIENT_CREATE,
    entityType: ENTITY_TYPES.CLIENT,
    entityId: client.id,
    changes: { clientCode, companyName: data.companyName },
  });

  return getClient(client.id);
};

export const updateClient = async (id, data, actorId) => {
  const client = await findClientOrFail(id);

  if (data.clientCode !== undefined) {
    const clientCode = normalizeClientCode(data.clientCode);
    if (clientCode !== client.clientCode) {
      await assertCodeAvailable(clientCode, id);
      client.clientCode = clientCode;
    }
  }
  if (data.companyName !== undefined) {
    client.companyName = sanitizeUserHtml(data.companyName);
  }
  if (data.locationName !== undefined) {
    const { location } = await locationsService.findOrCreateByName(
      data.locationName,
      actorId,
    );
    client.location = location.id;
  }

  const optionalFields = [
    'draftName',
    'authorityName',
    'address',
    'rcNumber',
    'contactNumber',
    'fundCode',
    'phyCode',
    'status',
    'signatoryName',
  ];
  for (const field of optionalFields) {
    if (data[field] !== undefined) {
      client[field] = blankToNull(data[field]);
    }
  }
  if (data.includeEmployeesOnForm5 !== undefined) {
    client.includeEmployeesOnForm5 = Boolean(data.includeEmployeesOnForm5);
  }

  client.updatedBy = actorId;
  const changedFields = client.modifiedPaths().filter((f) => f !== 'updatedBy');
  await clientsRepository.saveClient(client);

  await recordActivity({
    action: ACTIVITY_ACTIONS.CLIENT_UPDATE,
    entityType: ENTITY_TYPES.CLIENT,
    entityId: client.id,
    changes: { fields: changedFields, clientCode: client.clientCode },
  });

  return getClient(client.id);
};

export const deleteClient = async (id, actorId) => {
  const client = await findClientOrFail(id);
  await client.softDelete(actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.CLIENT_SOFT_DELETE,
    entityType: ENTITY_TYPES.CLIENT,
    entityId: client.id,
    changes: { clientCode: client.clientCode },
  });
};

const isDuplicateKey = (err) => err?.code === 11000;

const resolveLocationForImport = async (locationName, actorId, cache) => {
  const trimmed = String(locationName ?? '').trim();
  const nameKey = toLocationNameKey(trimmed);
  if (cache?.locationsByNameKey && nameKey) {
    const cached = cache.locationsByNameKey.get(nameKey);
    if (cached) return cached;
  }

  const { location } = await locationsService.findOrCreateByName(
    trimmed,
    actorId,
    { silent: true },
  );
  rememberLocation(cache, location);
  return location;
};

/**
 * Upsert a client from a MasterSheet row. Match is by client code only
 * (e.g. C0001). Empty cells on an existing client are left unchanged so a
 * sparse re-upload cannot wipe masters. Optional `cache` skips per-row finds.
 */
export const upsertFromMasterRow = async (fields, actorId, cache = null) => {
  const prepared = await prepareMasterClientUpsert(fields, actorId, cache);
  if (prepared.outcome === 'skipped') {
    return { outcome: 'skipped', reason: prepared.reason };
  }

  if (prepared.existing) {
    const { existing, setDoc } = prepared;
    Object.assign(existing, setDoc);
    existing.updatedBy = actorId;
    await clientsRepository.saveClient(existing);
    rememberClient(cache, existing);
    return { outcome: 'updated', client: existing };
  }

  try {
    const client = await clientsRepository.createClient({
      ...prepared.setDoc,
      ...prepared.setOnInsert,
      createdBy: actorId,
    });
    rememberClient(cache, client);
    return { outcome: 'inserted', client };
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const raced = await clientsRepository.findClientByCode(prepared.clientCode);
    if (!raced) throw err;
    rememberClient(cache, raced);
    return upsertFromMasterRow(fields, actorId, cache);
  }
};

/**
 * Validate + resolve location for a MasterSheet / Client-Master row.
 * Match is by clientCode only; returns a bulk-ready $set document.
 */
export const prepareMasterClientUpsert = async (fields, actorId, cache = null) => {
  const clientCode = normalizeClientCode(fields.clientCode);
  if (!clientCode) {
    return { outcome: 'skipped', reason: 'Missing client code' };
  }
  if (!CLIENT_CODE_PATTERN.test(clientCode) || clientCode.length > 32) {
    return { outcome: 'skipped', reason: 'Invalid client code' };
  }

  const companyName = sanitizeUserHtml(String(fields.companyName ?? '').trim());
  const locationName = String(fields.locationName ?? '').trim();
  const existing =
    cache?.clientsByCode?.get(clientCode) ??
    (await clientsRepository.findClientByCode(clientCode));

  if (!existing) {
    if (!companyName) {
      return { outcome: 'skipped', reason: 'Missing company name' };
    }
    if (!locationName) {
      return { outcome: 'skipped', reason: 'Missing location' };
    }

    const location = await resolveLocationForImport(
      locationName,
      actorId,
      cache,
    );

    const setDoc = {
      clientCode,
      companyName,
      draftName: blankToNull(fields.draftName) ?? null,
      location: location.id || location._id,
      rcNumber: blankToNull(fields.rcNumber) ?? null,
      contactNumber: blankToNull(fields.contactNumber) ?? null,
      fundCode: blankToNull(fields.fundCode) ?? null,
      phyCode:
        blankToNull(fields.phyCode) || extractPhyCode(companyName) || null,
      status: blankToNull(fields.status) ?? null,
      address: blankToNull(fields.address) ?? null,
      includeEmployeesOnForm5: true,
      updatedAt: new Date(),
    };

    return {
      outcome: 'ready',
      clientCode,
      existing: null,
      setDoc,
      setOnInsert: {
        createdBy: actorId,
        createdAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      },
    };
  }

  const setDoc = {};
  if (companyName) setDoc.companyName = companyName;

  if (locationName) {
    const location = await resolveLocationForImport(
      locationName,
      actorId,
      cache,
    );
    setDoc.location = location.id || location._id;
  }

  const optionalFields = [
    'draftName',
    'rcNumber',
    'contactNumber',
    'fundCode',
    'status',
    'address',
  ];
  for (const field of optionalFields) {
    if (fields[field] === undefined) continue;
    const next = blankToNull(fields[field]);
    if (next === null) continue;
    setDoc[field] = next;
  }

  const nextPhy =
    blankToNull(fields.phyCode) ||
    extractPhyCode(setDoc.companyName || existing.companyName);
  if (nextPhy) setDoc.phyCode = nextPhy;

  setDoc.updatedBy = actorId;
  setDoc.updatedAt = new Date();

  return {
    outcome: 'ready',
    clientCode,
    existing,
    setDoc,
    setOnInsert: null,
  };
};

/**
 * Unique clientCode match → full-row replace via bulkWrite (chunked).
 * Later duplicate codes in the same sheet win.
 */
export const bulkUpsertMasterClients = async ({
  preparedRows,
  actorId,
  cache,
  chunkSize = 500,
  onChunk,
}) => {
  const report = { inserted: 0, updated: 0, unchanged: 0, skipped: [] };

  /** @type {Map<string, object>} */
  const byCode = new Map();
  for (const row of preparedRows) {
    if (row.outcome === 'skipped') {
      report.skipped.push({ row: row.excelRow, reason: row.reason });
      continue;
    }
    byCode.set(row.clientCode, row);
  }

  const writeRows = [...byCode.values()];
  const ops = [];
  const meta = [];

  for (const row of writeRows) {
    if (row.existing?._id) {
      ops.push({
        updateOne: {
          filter: { _id: row.existing._id },
          update: { $set: row.setDoc },
        },
      });
      meta.push({ kind: 'update', row });
    } else {
      ops.push({
        updateOne: {
          filter: { clientCode: row.clientCode, isDeleted: false },
          update: {
            $set: { ...row.setDoc, updatedBy: actorId, updatedAt: new Date() },
            $setOnInsert: row.setOnInsert,
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
      await clientsRepository.bulkWriteClients(opChunk);
    }

    for (const item of metaChunk) {
      if (item.kind === 'insert') report.inserted += 1;
      else report.updated += 1;
    }

    // Refresh cache with persisted clients for filing upserts.
    const codes = metaChunk.map((item) => item.row.clientCode);
    const fresh = await clientsRepository.findClientsByCodes(codes);
    for (const client of fresh) {
      rememberClient(cache, client);
    }

    written += metaChunk.length;
    if (onChunk) {
      onChunk({ written, writeTotal: ops.length, report });
    }
  }

  if (!ops.length && onChunk) {
    onChunk({ written: 0, writeTotal: 0, report });
  }

  return {
    report,
    clientsByCode: cache?.clientsByCode ?? new Map(),
    writeRows,
  };
};

/**
 * Upsert address + RC Professional Tax Number from Client-Master.xlsx
 * (clientno). Creates the client when MasterSheet has not been imported yet.
 */
export const upsertFromClientMasterRow = async (
  fields,
  actorId,
  cache = null,
) => {
  const clientCode = normalizeClientCode(fields.clientCode);
  if (!clientCode) {
    return { outcome: 'skipped', reason: 'Missing client code' };
  }
  if (!CLIENT_CODE_PATTERN.test(clientCode) || clientCode.length > 32) {
    return { outcome: 'skipped', reason: 'Invalid client code' };
  }

  const existing =
    cache?.clientsByCode?.get(clientCode) ??
    (await clientsRepository.findClientByCode(clientCode));
  if (existing) {
    return upsertFromMasterRow(
      {
        clientCode,
        companyName: fields.companyName,
        locationName: fields.locationName,
        rcNumber: fields.rcNumber,
        address: fields.address,
        status: fields.status,
        phyCode: fields.phyCode,
      },
      actorId,
      cache,
    );
  }

  const companyName = sanitizeUserHtml(String(fields.companyName ?? '').trim());
  const locationName = String(fields.locationName ?? '').trim();
  if (!companyName) {
    return {
      outcome: 'skipped',
      reason: 'Client is not in the MasterSheet and this row has no company name',
    };
  }
  if (!locationName) {
    return {
      outcome: 'skipped',
      reason: 'Client is not in the MasterSheet and this row has no location',
    };
  }

  return upsertFromMasterRow(
    {
      clientCode,
      companyName,
      locationName,
      rcNumber: fields.rcNumber,
      address: fields.address,
      status: fields.status,
      phyCode: fields.phyCode || extractPhyCode(companyName),
    },
    actorId,
    cache,
  );
};

