import AppError from '../../utils/AppError.js';
import storage from '../../storage/index.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as employeesRepository from '../employees/employees.repository.js';
import * as settingsService from '../settings/settings.service.js';
import {
  fillTemplateBuffer,
} from '../templates/templateFill.js';
import {
  normalizePhyCode,
  parseAmount,
  parseExcelDate,
  stringifyCell,
} from '../uploads/masterParse.js';
import {
  filingCacheKey,
  rememberFiling,
} from '../uploads/importCache.js';
import * as ptSlabsService from '../ptSlabs/ptSlabs.service.js';
import { FILINGS_CODES, GENERATE_STATUSES } from './filings.constants.js';
import { toFilingDto, toFilingListDto } from './filings.dto.js';
import * as filingsRepository from './filings.repository.js';
import {
  buildComputationFromMaster,
  buildForm5Values,
  form5Filename,
} from './form5Values.js';
import {
  employeeCountsForList,
  employeesForClientLocation,
  filterEmployeesForClientLocation,
} from './employeeListForFiling.js';
import { computePt, periodToDate } from './ptCompute.js';
import { resolveForm5OutputBuffer } from './form5Output.js';
import * as templatesRepository from '../templates/templates.repository.js';
import * as templatesService from '../templates/templates.service.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const blankToNull = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  const cleaned = sanitizeUserHtml(String(value).trim());
  return cleaned === '' ? null : cleaned;
};

const dateStamp = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return stringifyCell(date);
};

const sameValue = (left, right) => {
  if (left instanceof Date || right instanceof Date) {
    return dateStamp(left) === dateStamp(right);
  }
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left ?? NaN) === Number(right ?? NaN) || (left == null && right == null);
  }
  return (left ?? null) === (right ?? null);
};

const toFilingDtoWithHint = async (filing, extras = {}) => {
  const globalDefault = await templatesRepository.findGlobalDefault();
  return toFilingDto(filing, { globalDefault, ...extras });
};

const loadEmployeesForClientPeriod = (client, period) =>
  employeesRepository.findEmployeesForCompute(
    employeesFilterForClient(client, period),
  );

const buildEmployeePreview = async (client, period) => {
  const [employees, slabs] = await Promise.all([
    loadEmployeesForClientPeriod(client, period),
    ptSlabsService.listEffectiveSlabs(periodToDate(period) || new Date()),
  ]);
  const listed = employeesForClientLocation({
    employees,
    client,
    period,
    slabs,
  });
  return {
    ...employeeCountsForList(listed, slabs),
    employees: listed,
  };
};

const slabEmployeeCounts = (result) => ({
  taxableEmployeeCount: (result.slabs || []).reduce(
    (sum, row) => sum + (row.taxableCount || 0),
    0,
  ),
  exemptEmployeeCount: (result.slabs || []).reduce(
    (sum, row) => sum + (row.exemptCount || 0),
    0,
  ),
});

const buildListFilter = async (query) => {
  const { search, period, generateStatus, locationId, clientId } = query;
  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ clientCode: regex }];
  }
  if (period) filter.period = period;
  if (generateStatus) filter.generateStatus = generateStatus;

  if (clientId && locationId) {
    const client = await clientsRepository.findClientById(clientId);
    const loc = client?.location?.id || client?.location;
    if (!client || String(loc) !== String(locationId)) {
      filter.client = { $in: [] };
      return filter;
    }
    filter.client = clientId;
  } else if (clientId) {
    filter.client = clientId;
  } else if (locationId) {
    const ids = await clientsRepository.findClientIdsByLocation(locationId);
    filter.client = { $in: ids };
  }

  return filter;
};

export const listFilings = async (query) => {
  const { page, limit, sortBy, sortOrder } = query;
  const filter = await buildListFilter(query);

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [filings, total, globalDefault] = await Promise.all([
    filingsRepository.findFilings(filter, { sort, skip, limit }),
    filingsRepository.countFilings(filter),
    templatesRepository.findGlobalDefault(),
  ]);

  return {
    filings: toFilingListDto(filings, { globalDefault }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const MONTHLY_FIELDS = [
  'status',
  'taskNo',
  'ptAmount',
  'chequeNo',
  'sentDate',
  'challanNo',
  'challanDate',
  'receivedInBank',
  'lessPaymentReceived',
  'link',
  'mailStatus',
  'originalChallanStatus',
  'periodLabel',
];

const toMonthlyPayload = (fields, periodLabel) => {
  const payload = {};
  if (fields.status !== undefined) payload.status = blankToNull(fields.status) ?? null;
  if (fields.taskNo !== undefined) payload.taskNo = blankToNull(fields.taskNo) ?? null;
  if (fields.ptAmount !== undefined) payload.ptAmount = parseAmount(fields.ptAmount);
  if (fields.chequeNo !== undefined) payload.chequeNo = blankToNull(fields.chequeNo) ?? null;
  if (fields.sentDate !== undefined) payload.sentDate = parseExcelDate(fields.sentDate);
  if (fields.challanNo !== undefined) {
    payload.challanNo = blankToNull(fields.challanNo) ?? null;
  }
  if (fields.challanDate !== undefined) {
    payload.challanDate = parseExcelDate(fields.challanDate);
  }
  if (fields.receivedInBank !== undefined) {
    payload.receivedInBank = blankToNull(fields.receivedInBank) ?? null;
  }
  if (fields.lessPaymentReceived !== undefined) {
    payload.lessPaymentReceived = blankToNull(fields.lessPaymentReceived) ?? null;
  }
  if (fields.link !== undefined) payload.link = blankToNull(fields.link) ?? null;
  if (fields.mailStatus !== undefined) {
    payload.mailStatus = blankToNull(fields.mailStatus) ?? null;
  }
  if (fields.originalChallanStatus !== undefined) {
    payload.originalChallanStatus = blankToNull(fields.originalChallanStatus) ?? null;
  }
  if (periodLabel !== undefined) {
    payload.periodLabel = blankToNull(periodLabel) ?? null;
  }
  return payload;
};

/**
 * Upsert a monthly filing stub. Rows absent from the file are kept.
 * Optional `cache.filingsByKey` skips per-row finds during MasterSheet import.
 */
export const upsertFromMasterRow = async ({
  client,
  fields,
  period,
  periodLabel,
  actorId,
  cache = null,
}) => {
  if (!period) {
    return { outcome: 'skipped', reason: 'Missing or unrecognised month' };
  }

  const payload = toMonthlyPayload(fields, periodLabel);
  const key = filingCacheKey(client.id, period);
  let existing =
    cache?.filingsByKey?.get(key) ??
    (await filingsRepository.findFilingByClientAndPeriod(client.id, period));

  if (!existing) {
    try {
      const filing = await filingsRepository.createFiling({
        client: client.id,
        clientCode: client.clientCode,
        period,
        ...Object.fromEntries(MONTHLY_FIELDS.map((key) => [key, payload[key] ?? null])),
        createdBy: actorId,
      });
      rememberFiling(cache, filing);
      return { outcome: 'inserted', filing };
    } catch (err) {
      if (err?.code !== 11000) throw err;
      existing = await filingsRepository.findFilingByClientAndPeriod(
        client.id,
        period,
      );
      if (!existing) throw err;
      rememberFiling(cache, existing);
    }
  }

  for (const field of MONTHLY_FIELDS) {
    if (payload[field] === undefined) continue;
    if (!sameValue(existing[field], payload[field])) {
      existing[field] = payload[field];
    }
  }

  const changedFields = existing
    .modifiedPaths()
    .filter((field) => field !== 'updatedBy');
  if (changedFields.length === 0) {
    rememberFiling(cache, existing);
    return { outcome: 'unchanged', filing: existing };
  }

  existing.updatedBy = actorId;
  await filingsRepository.saveFiling(existing);
  rememberFiling(cache, existing);
  return { outcome: 'updated', filing: existing };
};

const findFilingOrFail = async (id) => {
  const filing = await filingsRepository.findFilingById(id);
  if (!filing) {
    throw new AppError('Filing not found', 404, {
      code: FILINGS_CODES.FILING_NOT_FOUND,
    });
  }
  return filing;
};

const employeesFilterForClient = (client, period) => {
  const filter = { period };
  const phyCode = normalizePhyCode(client?.phyCode);
  const or = [{ client: client.id }];
  if (client?.clientCode) {
    or.push({ clientCode: client.clientCode });
  }
  if (phyCode) {
    or.push({ phyCode });
  }
  filter.$or = or;
  return filter;
};

export const getFiling = async (id) => {
  const filing = await findFilingOrFail(id);
  const employeePreview = filing.client
    ? await buildEmployeePreview(filing.client, filing.period)
    : null;
  return toFilingDtoWithHint(filing, { employeePreview });
};

/**
 * Load employees for this client+month, bucket PT GROSS into effective
 * slabs, and persist Total A / NIL B / NIL interest. Unmatched PHY rows
 * are excluded from counts but reported.
 */
export const computeFiling = async (id, actorId) => {
  const filing = await findFilingOrFail(id);
  const client = filing.client;
  if (!client) {
    throw new AppError('Filing client is missing', 404, {
      code: FILINGS_CODES.FILING_NOT_FOUND,
    });
  }

  const at = periodToDate(filing.period) || new Date();
  const slabs = await ptSlabsService.listEffectiveSlabs(at);
  if (!slabs.length) {
    throw new AppError(
      'No PT slabs are in force for this period. Add slabs under PT Slabs.',
      422,
      { code: FILINGS_CODES.NO_SLABS },
    );
  }

  const employees = await loadEmployeesForClientPeriod(client, filing.period);
  const locationEmployees = filterEmployeesForClientLocation({
    employees,
    client,
    period: filing.period,
  });

  const result = computePt(slabs, locationEmployees);
  const counts = slabEmployeeCounts(result);

  filing.computation = {
    ...result,
    totalEmployeeCount: result.employeeCount,
    ...counts,
    computedAt: new Date(),
  };
  filing.updatedBy = actorId;
  await filingsRepository.saveFiling(filing);

  await recordActivity({
    action: ACTIVITY_ACTIONS.FILING_COMPUTE,
    entityType: ENTITY_TYPES.FILING,
    entityId: filing.id,
    changes: {
      clientCode: filing.clientCode,
      period: filing.period,
      totalA: result.totalA,
      employeeCount: result.employeeCount,
      taxableEmployeeCount: counts.taxableEmployeeCount,
      exemptEmployeeCount: counts.exemptEmployeeCount,
      unmatchedExcluded: result.unmatchedExcluded,
      varianceCount: result.varianceCount,
    },
  });

  return toFilingDtoWithHint(await findFilingOrFail(id), {
    employeePreview: await buildEmployeePreview(client, filing.period),
  });
};

export const updateFilingOverrides = async (id, body, actorId) => {
  const filing = await findFilingOrFail(id);

  const next = {
    employerAddress:
      body.employerAddress !== undefined
        ? blankToNull(body.employerAddress)
        : filing.generateOverrides?.employerAddress ?? null,
    signatoryName:
      body.signatoryName !== undefined
        ? blankToNull(body.signatoryName)
        : filing.generateOverrides?.signatoryName ?? null,
    filingDate:
      body.filingDate !== undefined
        ? body.filingDate === null
          ? null
          : parseExcelDate(body.filingDate)
        : filing.generateOverrides?.filingDate ?? null,
    additionalTaxPayable:
      body.additionalTaxPayable !== undefined
        ? body.additionalTaxPayable === null
          ? null
          : parseAmount(body.additionalTaxPayable)
        : filing.generateOverrides?.additionalTaxPayable ?? null,
  };

  const hasAny =
    next.employerAddress ||
    next.signatoryName ||
    next.filingDate ||
    (next.additionalTaxPayable != null && next.additionalTaxPayable > 0);

  filing.generateOverrides = hasAny ? next : null;
  filing.updatedBy = actorId;
  await filingsRepository.saveFiling(filing);

  await recordActivity({
    action: ACTIVITY_ACTIONS.FILING_OVERRIDES_UPDATE,
    entityType: ENTITY_TYPES.FILING,
    entityId: filing.id,
    changes: {
      clientCode: filing.clientCode,
      period: filing.period,
      generateOverrides: filing.generateOverrides,
    },
  });

  const employeePreview = filing.client
    ? await buildEmployeePreview(filing.client, filing.period)
    : null;
  return toFilingDtoWithHint(await findFilingOrFail(id), { employeePreview });
};

const MAX_HISTORY = 20;

const toFileSnapshot = (file) => ({
  version: file.version,
  filename: file.filename,
  storedPath: file.storedPath,
  mimetype: file.mimetype,
  size: file.size,
  template: file.template,
  templateName: file.templateName,
  templateCode: file.templateCode,
  source: file.source,
  generatedAt: file.generatedAt,
});

export const generateFiling = async (id, actorId, options = {}) => {
  const { computeIfNeeded = false } = options;
  let filing = await findFilingOrFail(id);
  const clientId = filing.client?.id || filing.client;
  if (!clientId) {
    throw new AppError('Filing client is missing', 404, {
      code: FILINGS_CODES.FILING_NOT_FOUND,
    });
  }

  if (!filing.computation && computeIfNeeded) {
    try {
      await computeFiling(id, actorId);
      filing = await findFilingOrFail(id);
    } catch (error) {
      // Fall through to MasterSheet ptAmount when salary/slabs are unavailable.
      if (error?.statusCode && error.statusCode !== 422) throw error;
    }
  }

  const client = await clientsRepository.findClientById(clientId);
  if (!client) {
    throw new AppError('Filing client is missing', 404, {
      code: FILINGS_CODES.FILING_NOT_FOUND,
    });
  }

  const resolved = await templatesService.resolveTemplate(client.id);
  if (!resolved.template?.id) {
    throw new AppError(
      'No Form 5 template is assigned for this client. Set a client, location, or global template first.',
      422,
      { code: FILINGS_CODES.NO_TEMPLATE },
    );
  }

  const template = await templatesRepository.findTemplateByIdWithPath(
    resolved.template.id,
  );
  if (!template?.storedPath) {
    throw new AppError(
      'No Form 5 template is assigned for this client. Set a client, location, or global template first.',
      422,
      { code: FILINGS_CODES.NO_TEMPLATE },
    );
  }

  const generatedAt = new Date();
  const settings = await settingsService.getSettings();
  let computation = filing.computation;
  const at = periodToDate(filing.period) || new Date();
  const slabs = await ptSlabsService.listEffectiveSlabs(at);
  if (!computation) {
    computation = buildComputationFromMaster(filing, slabs);
  }

  const employees = await loadEmployeesForClientPeriod(client, filing.period);
  const includeEmployees = client.includeEmployeesOnForm5 !== false;
  const listedEmployees = includeEmployees
    ? employeesForClientLocation({
        employees,
        client,
        period: filing.period,
        slabs,
      })
    : [];

  const values = buildForm5Values({
    filing: {
      clientCode: filing.clientCode,
      period: filing.period,
      periodLabel: filing.periodLabel,
      ptAmount: filing.ptAmount,
      challanNo: filing.challanNo,
      challanDate: filing.challanDate,
      generateOverrides: filing.generateOverrides,
      computation,
    },
    client,
    settings,
    generatedAt,
    employees: listedEmployees,
    includeEmployees,
    templateCode: template.code,
  });

  try {
    const sourceBuffer = await templatesService.readTemplateBuffer(template);
    const filled = await fillTemplateBuffer({
      buffer: sourceBuffer,
      kind: template.kind,
      originalName: template.originalName,
      mapping: resolved.mapping || template.mapping,
      values,
    });

    const { buffer: outputBuffer, ext, mimetype } = await resolveForm5OutputBuffer({
      template,
      filled,
      filing,
      client,
    });

    const filename = form5Filename({
      clientCode: filing.clientCode,
      locationName: client.location?.name,
      period: filing.period,
      ext,
    });
    const stored = await storage.saveDocument({
      buffer: outputBuffer,
      mimetype,
      folder: 'generated',
      originalName: filename,
    });

    const nextVersion = (filing.generatedFile?.version || 0) + 1;
    if (filing.generatedFile?.storedPath) {
      filing.generatedHistory = [
        ...(filing.generatedHistory || []),
        toFileSnapshot(filing.generatedFile),
      ];
      while (filing.generatedHistory.length > MAX_HISTORY) {
        const dropped = filing.generatedHistory.shift();
        if (dropped?.storedPath) await storage.deleteFile(dropped.storedPath);
      }
    }

    filing.generatedFile = {
      version: nextVersion,
      filename,
      storedPath: stored.path,
      mimetype: stored.mimetype,
      size: stored.size,
      template: template.id,
      templateName: template.name,
      templateCode: template.code,
      source: resolved.source,
      generatedAt,
    };
    filing.generateStatus = GENERATE_STATUSES.GENERATED;
    filing.updatedBy = actorId;
    await filingsRepository.saveFiling(filing);
  } catch (error) {
    filing.generateStatus = GENERATE_STATUSES.FAILED;
    filing.updatedBy = actorId;
    await filingsRepository.saveFiling(filing);
    throw error;
  }

  await recordActivity({
    action: ACTIVITY_ACTIONS.FILING_GENERATE,
    entityType: ENTITY_TYPES.FILING,
    entityId: filing.id,
    changes: {
      clientCode: filing.clientCode,
      period: filing.period,
      version: filing.generatedFile?.version,
      filename: filing.generatedFile?.filename,
      templateCode: template.code,
      source: resolved.source,
    },
  });

  return toFilingDtoWithHint(await findFilingOrFail(id));
};

const BULK_LIMIT = 200;
/** Parallel Form 5 renders (shared Chromium). Keep low to avoid RAM spikes. */
const BULK_CONCURRENCY = 2;

const emitBulkProgress = (onProgress, snapshot) => {
  if (typeof onProgress === 'function') {
    onProgress(snapshot);
  }
};

const processOneBulkFiling = async (id, actorId) => {
  let filing;
  try {
    filing = await findFilingOrFail(id);
  } catch {
    return {
      id,
      clientCode: null,
      outcome: 'failed',
      reason: 'Filing not found',
      filename: null,
    };
  }

  const clientId = filing.client?.id || filing.client;
  if (!clientId) {
    return {
      id,
      clientCode: filing.clientCode,
      outcome: 'failed',
      reason: 'Filing client is missing',
      filename: null,
    };
  }

  const resolved = await templatesService.resolveTemplate(clientId);
  if (!resolved.template?.id) {
    return {
      id,
      clientCode: filing.clientCode,
      outcome: 'skipped',
      reason: 'No template assigned',
      filename: null,
    };
  }

  try {
    const updated = await generateFiling(id, actorId, {
      computeIfNeeded: true,
    });
    return {
      id,
      clientCode: updated.clientCode,
      outcome: 'generated',
      reason: null,
      filename: updated.generatedFile?.filename || null,
    };
  } catch (error) {
    return {
      id,
      clientCode: filing.clientCode,
      outcome: 'failed',
      reason: error.message || 'Generate failed',
      filename: null,
    };
  }
};

/**
 * Run async workers over ids with a fixed concurrency limit.
 */
const mapWithConcurrency = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  };

  const poolSize = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(
    Array.from({ length: poolSize }, () => runWorker()),
  );
  return results;
};

export const bulkGenerateFilings = async (body, actorId, onProgress) => {
  let ids = [...new Set((body.ids || []).map((value) => String(value)))];

  if (!ids.length) {
    const filter = await buildListFilter(body);
    const docs = await filingsRepository.findFilingIds(filter, {
      sort: { clientCode: 1 },
      limit: BULK_LIMIT,
    });
    ids = docs.map((doc) => String(doc.id));
  }

  if (ids.length > BULK_LIMIT) {
    ids = ids.slice(0, BULK_LIMIT);
  }

  const total = ids.length;
  const results = [];
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  emitBulkProgress(onProgress, {
    phase: 'generate',
    processed: 0,
    total,
    generated: 0,
    skipped: 0,
    failed: 0,
    current: null,
    lastResult: null,
  });

  await mapWithConcurrency(ids, BULK_CONCURRENCY, async (id) => {
    const row = await processOneBulkFiling(id, actorId);

    if (row.outcome === 'generated') generated += 1;
    else if (row.outcome === 'skipped') skipped += 1;
    else failed += 1;

    processed += 1;
    results.push(row);

    emitBulkProgress(onProgress, {
      phase: 'generate',
      processed,
      total,
      generated,
      skipped,
      failed,
      current: row.clientCode
        ? { id: row.id, clientCode: row.clientCode }
        : { id: row.id, clientCode: null },
      lastResult: row,
    });

    return row;
  });

  // Keep report order stable by original id list
  const byId = new Map(results.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  await recordActivity({
    action: ACTIVITY_ACTIONS.FILING_BULK_GENERATE,
    entityType: ENTITY_TYPES.FILING,
    entityId: actorId,
    changes: {
      generated,
      skipped,
      failed,
      count: ids.length,
      period: body.period || null,
    },
  });

  return {
    generated,
    skipped,
    failed,
    results: ordered,
  };
};

const findOutput = (filing, version) => {
  if (!version || version === filing.generatedFile?.version) {
    return filing.generatedFile;
  }
  return (filing.generatedHistory || []).find((row) => row.version === version);
};

export const downloadGenerated = async (id, version) => {
  const filing = await findFilingOrFail(id);
  const file = findOutput(filing, version == null ? null : Number(version));
  if (!file?.storedPath) {
    throw new AppError('No generated Form 5 file for this filing.', 404, {
      code: FILINGS_CODES.OUTPUT_NOT_FOUND,
    });
  }
  const buffer = await storage.readFileBuffer(file.storedPath);
  return {
    buffer,
    filename: file.filename,
    mimetype: file.mimetype,
  };
};
