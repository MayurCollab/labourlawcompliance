import AppError from '../../utils/AppError.js';
import storage from '../../storage/index.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ensurePdfFilename,
  normalizeWhatsAppPhone,
} from '../../integrations/msg91/phone.js';
import { sendForm5WhatsAppTemplate } from '../../integrations/msg91/whatsapp.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as clientsService from '../clients/clients.service.js';
import * as employeesRepository from '../employees/employees.repository.js';
import * as settingsService from '../settings/settings.service.js';
import {
  fillTemplateBuffer,
} from '../templates/templateFill.js';
import {
  parseAmount,
  parseExcelDate,
  stringifyCell,
} from '../uploads/masterParse.js';
import {
  filingCacheKey,
  rememberFiling,
} from '../uploads/importCache.js';
import * as ptSlabsService from '../ptSlabs/ptSlabs.service.js';
import { WHATSAPP_SEND_STATUSES } from '../whatsappSends/whatsappSends.constants.js';
import { recordWhatsAppSend } from '../whatsappSends/whatsappSends.service.js';
import { FILINGS_CODES, GENERATE_STATUSES } from './filings.constants.js';
import { toFilingDto, toFilingListDto } from './filings.dto.js';
import * as filingsRepository from './filings.repository.js';
import {
  buildComputationFromMaster,
  buildForm5Values,
  form5Filename,
  periodBounds,
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

const normalizeIdList = (...groups) => {
  const ids = [];
  for (const group of groups) {
    if (!group) continue;
    if (Array.isArray(group)) {
      for (const item of group) {
        if (item) ids.push(String(item));
      }
    } else {
      ids.push(String(group));
    }
  }
  return [...new Set(ids)];
};

const buildListFilter = async (query) => {
  const { search, period, generateStatus } = query;
  const locationIds = normalizeIdList(query.locationIds, query.locationId);
  const clientIds = normalizeIdList(query.clientIds, query.clientId);
  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ clientCode: regex }];
  }
  if (period) filter.period = period;
  if (generateStatus) filter.generateStatus = generateStatus;

  if (clientIds.length && locationIds.length) {
    const inLocations =
      await clientsRepository.findClientIdsByLocations(locationIds);
    const allowed = new Set(inLocations.map(String));
    filter.client = {
      $in: clientIds.filter((id) => allowed.has(String(id))),
    };
  } else if (clientIds.length) {
    filter.client = { $in: clientIds };
  } else if (locationIds.length) {
    const ids = await clientsRepository.findClientIdsByLocations(locationIds);
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
 * Match by (client, period) only, then replace monthly fields from the sheet.
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
  const key = filingCacheKey(client.id || client._id, period);
  let existing =
    cache?.filingsByKey?.get(key) ??
    (await filingsRepository.findFilingByClientAndPeriod(
      client.id || client._id,
      period,
    ));

  if (!existing) {
    try {
      const filing = await filingsRepository.createFiling({
        client: client.id || client._id,
        clientCode: client.clientCode,
        period,
        ...Object.fromEntries(
          MONTHLY_FIELDS.map((field) => [field, payload[field] ?? null]),
        ),
        createdBy: actorId,
      });
      rememberFiling(cache, filing);
      return { outcome: 'inserted', filing };
    } catch (err) {
      if (err?.code !== 11000) throw err;
      existing = await filingsRepository.findFilingByClientAndPeriod(
        client.id || client._id,
        period,
      );
      if (!existing) throw err;
      rememberFiling(cache, existing);
    }
  }

  for (const field of MONTHLY_FIELDS) {
    if (payload[field] === undefined) continue;
    existing[field] = payload[field];
  }

  existing.updatedBy = actorId;
  await filingsRepository.saveFiling(existing);
  rememberFiling(cache, existing);
  return { outcome: 'updated', filing: existing };
};

/**
 * Unique (client, period) match → bulk replace monthly filing fields.
 */
export const bulkUpsertFilingsFromMaster = async ({
  rows,
  actorId,
  cache,
  chunkSize = 500,
  onChunk,
}) => {
  const report = { inserted: 0, updated: 0, unchanged: 0, skipped: [] };

  /** @type {Map<string, object>} */
  const byKey = new Map();

  for (const row of rows) {
    const { client, fields, period, periodLabel, excelRow } = row;
    if (!period) {
      report.skipped.push({
        row: excelRow,
        reason: 'Missing or unrecognised month',
      });
      continue;
    }

    const clientId = client.id || client._id;
    const key = filingCacheKey(clientId, period);
    const payload = toMonthlyPayload(fields, periodLabel);
    const existing = cache?.filingsByKey?.get(key) ?? null;

    byKey.set(key, {
      client,
      clientId,
      period,
      payload,
      existing,
      excelRow,
    });
  }

  const writeRows = [...byKey.values()];
  const ops = [];
  const meta = [];

  for (const row of writeRows) {
    const monthlySet = Object.fromEntries(
      MONTHLY_FIELDS.map((field) => [field, row.payload[field] ?? null]),
    );

    if (row.existing?._id) {
      ops.push({
        updateOne: {
          filter: { _id: row.existing._id },
          update: {
            $set: {
              ...monthlySet,
              clientCode: row.client.clientCode,
              updatedBy: actorId,
              updatedAt: new Date(),
            },
          },
        },
      });
      meta.push({ kind: 'update', row });
    } else {
      ops.push({
        updateOne: {
          filter: {
            client: row.clientId,
            period: row.period,
            isDeleted: false,
          },
          update: {
            $set: {
              ...monthlySet,
              client: row.clientId,
              clientCode: row.client.clientCode,
              period: row.period,
              updatedBy: actorId,
              updatedAt: new Date(),
            },
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
      await filingsRepository.bulkWriteFilings(opChunk);
    }

    for (const item of metaChunk) {
      if (item.kind === 'insert') report.inserted += 1;
      else report.updated += 1;

      if (item.row.existing) {
        Object.assign(item.row.existing, item.row.payload, {
          updatedBy: actorId,
        });
        rememberFiling(cache, item.row.existing);
      } else {
        rememberFiling(cache, {
          client: item.row.clientId,
          period: item.row.period,
          clientCode: item.row.client.clientCode,
          ...item.row.payload,
        });
      }
    }

    written += metaChunk.length;
    if (onChunk) {
      onChunk({ written, writeTotal: ops.length, report });
    }
  }

  if (!ops.length && onChunk) {
    onChunk({ written: 0, writeTotal: 0, report });
  }

  return report;
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
  // Scope by client ownership only. PHY_CODE is a branch tag that can be
  // shared across clients on salary sheets (e.g. C0030 vs C0299 both 0654),
  // so matching on PHY alone leaks another client's employees into Form-5.
  const filter = { period };
  const or = [{ client: client.id }];
  if (client?.clientCode) {
    or.push({ clientCode: client.clientCode });
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

  // Always recompute from salary when asked — stale master/empty computation
  // left Form 5 slabs blank even when the employee list had rows.
  if (computeIfNeeded) {
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
      companyName: client.companyName,
      clientCode: filing.clientCode,
      locationName: client.location?.name,
      period: filing.period,
      periodLabel: filing.periodLabel || periodBounds(filing.period).label,
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

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const periodMonthAndYear = (period) => {
  const match = String(period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return { monthName: '', year: '' };
  const month = Number(match[2]);
  return {
    monthName: MONTH_NAMES[month - 1] || match[2],
    year: match[1],
  };
};

const clientRefId = (client) => {
  if (!client) return null;
  if (typeof client === 'object') {
    return client.id || (client._id ? String(client._id) : null);
  }
  return String(client);
};

/**
 * Send the latest generated Form 5 PDF on WhatsApp via MSG91.
 * Uses the public S3 object URL stored on generatedFile.storedPath.
 */
export const sendFilingWhatsApp = async (id, body, actorId) => {
  const filing = await findFilingOrFail(id);

  if (
    filing.generateStatus !== GENERATE_STATUSES.GENERATED ||
    !filing.generatedFile?.storedPath
  ) {
    throw new AppError(
      'Generate the Form 5 PDF before sending on WhatsApp.',
      400,
      { code: FILINGS_CODES.WHATSAPP_NOT_GENERATED },
    );
  }

  const mediaUrl = String(filing.generatedFile.storedPath || '').trim();
  if (!/^https?:\/\//i.test(mediaUrl)) {
    throw new AppError(
      'Generated file has no public S3 URL. Use S3 storage for WhatsApp send.',
      400,
      { code: FILINGS_CODES.WHATSAPP_MEDIA_URL_MISSING },
    );
  }

  const rawPhone =
    body?.phone !== undefined && body?.phone !== null && String(body.phone).trim()
      ? String(body.phone).trim()
      : filing.client?.contactNumber;

  if (!rawPhone) {
    throw new AppError(
      'Add a mobile number for this client before sending on WhatsApp.',
      400,
      { code: FILINGS_CODES.WHATSAPP_PHONE_REQUIRED },
    );
  }

  const phone = normalizeWhatsAppPhone(rawPhone);
  if (!phone) {
    throw new AppError('Mobile number is invalid.', 400, {
      code: FILINGS_CODES.WHATSAPP_PHONE_INVALID,
    });
  }

  const clientId = clientRefId(filing.client);
  const shouldSavePhone = body?.savePhone !== false;
  if (shouldSavePhone && clientId && body?.phone !== undefined) {
    await clientsService.updateClient(
      clientId,
      { contactNumber: String(body.phone).trim() || null },
      actorId,
    );
  }

  const { monthName, year } = periodMonthAndYear(filing.period);
  const companyName =
    filing.client?.companyName || filing.clientCode || 'Client';
  const filename = ensurePdfFilename(filing.generatedFile.filename);

  const sendLedgerBase = {
    filingId: filing.id,
    clientId,
    clientCode: filing.clientCode,
    companyName:
      filing.client?.companyName || filing.clientCode || null,
    phone,
    period: filing.period,
    periodLabel: filing.periodLabel || null,
    filename,
    mediaUrl,
    actorId,
  };

  let msg91Response;
  try {
    msg91Response = await sendForm5WhatsAppTemplate({
      phone,
      filename,
      mediaUrl,
      companyName,
      monthName,
      year,
    });
  } catch (error) {
    await recordWhatsAppSend({
      ...sendLedgerBase,
      status: WHATSAPP_SEND_STATUSES.FAILED,
      errorMessage: error?.message || 'WhatsApp send failed',
      failedAt: new Date(),
    });
    throw error;
  }

  filing.sentDate = new Date();
  filing.mailStatus = 'WhatsApp sent';
  filing.updatedBy = actorId;
  await filingsRepository.saveFiling(filing);

  await recordActivity({
    action: ACTIVITY_ACTIONS.FILING_WHATSAPP_SEND,
    entityType: ENTITY_TYPES.FILING,
    entityId: filing.id,
    changes: {
      phone,
      filename,
      period: filing.period,
      clientCode: filing.clientCode,
    },
  });

  await recordWhatsAppSend({
    ...sendLedgerBase,
    status: WHATSAPP_SEND_STATUSES.ACCEPTED,
    providerResponse: msg91Response,
    sentAt: filing.sentDate,
  });

  return {
    filing: await toFilingDtoWithHint(await findFilingOrFail(id)),
    phone,
    msg91: msg91Response,
  };
};
