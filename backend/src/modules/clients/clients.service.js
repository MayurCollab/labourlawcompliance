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

const sameId = (left, right) => String(left ?? '') === String(right ?? '');

const sameText = (left, right) => (left ?? null) === (right ?? null);

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

    try {
      const client = await clientsRepository.createClient({
        clientCode,
        companyName,
        draftName: blankToNull(fields.draftName) ?? null,
        location: location.id,
        rcNumber: blankToNull(fields.rcNumber) ?? null,
        contactNumber: blankToNull(fields.contactNumber) ?? null,
        fundCode: blankToNull(fields.fundCode) ?? null,
        phyCode:
          blankToNull(fields.phyCode) || extractPhyCode(companyName) || null,
        status: blankToNull(fields.status) ?? null,
        address: blankToNull(fields.address) ?? null,
        includeEmployeesOnForm5: true,
        createdBy: actorId,
      });

      rememberClient(cache, client);
      return { outcome: 'inserted', client };
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const raced = await clientsRepository.findClientByCode(clientCode);
      if (!raced) throw err;
      rememberClient(cache, raced);
      return upsertFromMasterRow(fields, actorId, cache);
    }
  }

  if (companyName && companyName !== existing.companyName) {
    existing.companyName = companyName;
  }

  if (locationName) {
    const location = await resolveLocationForImport(
      locationName,
      actorId,
      cache,
    );
    if (!sameId(existing.location, location.id)) {
      existing.location = location.id;
    }
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
    if (!sameText(existing[field], next)) {
      existing[field] = next;
    }
  }

  const nextPhy =
    blankToNull(fields.phyCode) || extractPhyCode(existing.companyName);
  if (nextPhy && !sameText(existing.phyCode, nextPhy)) {
    existing.phyCode = nextPhy;
  }

  const changedFields = existing
    .modifiedPaths()
    .filter((field) => field !== 'updatedBy');
  if (changedFields.length === 0) {
    rememberClient(cache, existing);
    return { outcome: 'unchanged', client: existing };
  }

  existing.updatedBy = actorId;
  await clientsRepository.saveClient(existing);
  rememberClient(cache, existing);
  return { outcome: 'updated', client: existing };
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

