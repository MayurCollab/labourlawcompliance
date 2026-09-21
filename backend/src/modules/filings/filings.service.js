import AppError from '../../utils/AppError.js';
import storage from '../../storage/index.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import { periodMonthAndYear } from '../../utils/period.js';
import {
  ensurePdfFilename,
  normalizeWhatsAppPhone,
} from '../../integrations/msg91/phone.js';
import { sendWhatsAppTemplateBatch } from '../../integrations/msg91/whatsapp.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as clientsService from '../clients/clients.service.js';
import * as employeesRepository from '../employees/employees.repository.js';
import * as settingsService from '../settings/settings.service.js';
import * as uploadsRepository from '../uploads/uploads.repository.js';
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
import * as whatsappTemplatesService from '../whatsappTemplates/whatsappTemplates.service.js';
import { WHATSAPP_BODY_MODES } from '../whatsappTemplates/whatsappTemplates.constants.js';
import {
  buildWhatsAppSourceData,
  resolveWhatsAppMessage,
  toTemplateSnapshot,
  missingFieldsMessage,
  missingCustomValues,
} from '../whatsappTemplates/whatsappTemplates.resolve.js';
import { FILINGS_CODES, GENERATE_STATUSES } from './filings.constants.js';
import { toFilingDto, toFilingListDto } from './filings.dto.js';
import { buildPtMismatch, toPtMismatchDto } from './ptMismatch.js';
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
import { escapeRegex, exactMatchRegex, splitSearchTokens } from '../../utils/searchTokens.js';

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

const lastImportedMasterClientCodes = async () => {
  const upload = await uploadsRepository.findLatestImportedMaster();
  if (!upload) return [];

  const report = upload.report || {};
  const fromSheet = Array.isArray(report.clientCodes)
    ? report.clientCodes.filter(Boolean)
    : [];
  if (fromSheet.length) return [...new Set(fromSheet)];

  // Older imports did not store codes; approximate with filings touched
  // in the same window as the import.
  const importedAt = upload.updatedAt || upload.createdAt;
  if (!importedAt) return [];
  const start = new Date(new Date(importedAt).getTime() - 5_000);
  const end = new Date(new Date(importedAt).getTime() + 5 * 60 * 1000);
  const docs = await filingsRepository.findFilingIds(
    { updatedAt: { $gte: start, $lte: end } },
    { sort: { clientCode: 1 }, limit: 10_000 },
  );
  return [...new Set(docs.map((doc) => doc.clientCode).filter(Boolean))];
};

const buildListFilter = async (query) => {
  const { search, period, generateStatus } = query;
  const locationIds = normalizeIdList(query.locationIds, query.locationId);
  const clientIds = normalizeIdList(query.clientIds, query.clientId);
  const filter = {};
  if (period) filter.period = period;
  if (generateStatus) filter.generateStatus = generateStatus;

  const searchTokens = splitSearchTokens(search);
  const isMultiCodeSearch = searchTokens.length > 1;

  if (query.recentlyAdded) {
    const codes = await lastImportedMasterClientCodes();
    if (!codes.length) {
      filter._id = { $in: [] };
    } else if (search) {
      filter.clientCode = isMultiCodeSearch
        ? { $in: codes, $regex: exactMatchRegex(searchTokens) }
        : { $in: codes, $regex: escapeRegex(search), $options: 'i' };
    } else {
      filter.clientCode = { $in: codes };
    }
  } else if (isMultiCodeSearch) {
    // Pasted list of client codes (e.g. copied from Excel) — exact match, not substring.
    filter.$or = [{ clientCode: exactMatchRegex(searchTokens) }];
  } else if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ clientCode: regex }];
  }

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

const filingClientId = (filing) => {
  const client = filing.client;
  if (!client) return null;
  if (typeof client === 'object') {
    return String(client.id || client._id || '');
  }
  return String(client);
};

const salaryTotalsForFilings = async (filings) => {
  const totals = new Map();
  if (!filings.length) return totals;

  const rows = await employeesRepository.aggregatePTaxByClientPeriod({
    periods: filings.map((filing) => filing.period),
    clientIds: filings.map(filingClientId),
    clientCodes: filings.map((filing) => filing.clientCode),
  });

  const byClientId = new Map();
  const byClientCode = new Map();
  for (const row of rows) {
    const period = row._id?.period;
    const amount = Number(row.salaryPtTotal) || 0;
    const count = Number(row.employeeCount) || 0;
    if (row._id?.client) {
      const key = `${period}|${String(row._id.client)}`;
      const prev = byClientId.get(key) || { salaryPtTotal: 0, employeeCount: 0 };
      byClientId.set(key, {
        salaryPtTotal: prev.salaryPtTotal + amount,
        employeeCount: prev.employeeCount + count,
      });
    } else if (row._id?.clientCode) {
      const key = `${period}|${String(row._id.clientCode).trim().toUpperCase()}`;
      const prev = byClientCode.get(key) || {
        salaryPtTotal: 0,
        employeeCount: 0,
      };
      byClientCode.set(key, {
        salaryPtTotal: prev.salaryPtTotal + amount,
        employeeCount: prev.employeeCount + count,
      });
    }
  }

  for (const filing of filings) {
    const clientId = filingClientId(filing);
    const fromId = clientId
      ? byClientId.get(`${filing.period}|${clientId}`)
      : null;
    const fromCode = filing.clientCode
      ? byClientCode.get(
          `${filing.period}|${String(filing.clientCode).trim().toUpperCase()}`,
        )
      : null;
    const employeeCount =
      (fromId?.employeeCount || 0) + (fromCode?.employeeCount || 0);
    totals.set(String(filing.id || filing._id), {
      salaryPtTotal: employeeCount
        ? (fromId?.salaryPtTotal || 0) + (fromCode?.salaryPtTotal || 0)
        : null,
      employeeCount,
    });
  }

  return totals;
};

const withPtMismatch = (dto, filing, totalsById) => {
  const total = totalsById.get(String(filing.id || filing._id)) || {
    salaryPtTotal: null,
    employeeCount: 0,
  };
  return {
    ...dto,
    ...buildPtMismatch({
      ptAmount: filing.ptAmount,
      salaryPtTotal: total.salaryPtTotal,
      employeeCount: total.employeeCount,
    }),
  };
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
  const salaryTotals = await salaryTotalsForFilings(filings);

  return {
    filings: toFilingListDto(filings, { globalDefault }).map((dto, index) =>
      withPtMismatch(dto, filings[index], salaryTotals),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const listPtMismatches = async (query) => {
  const filter =
    query.ids && query.ids.length
      ? { _id: { $in: query.ids } }
      : await buildListFilter(query);
  const filings = await filingsRepository.findFilings(filter, {
    sort: { clientCode: 1 },
    skip: 0,
    limit: 10000,
  });
  const salaryTotals = await salaryTotalsForFilings(filings);
  const mismatches = toFilingListDto(filings)
    .map((dto, index) => withPtMismatch(dto, filings[index], salaryTotals))
    .map(toPtMismatchDto)
    .filter(Boolean);

  return { mismatches };
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
  const salaryPtTotal = employeePreview
    ? employeePreview.employees.reduce(
        (sum, row) => sum + (Number(row.pTax) || 0),
        0,
      )
    : null;
  return toFilingDtoWithHint(filing, {
    employeePreview,
    ...buildPtMismatch({
      ptAmount: filing.ptAmount,
      salaryPtTotal,
      employeeCount: employeePreview?.totalEmployeeCount ?? 0,
    }),
  });
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

// Period utilities moved to ../../utils/period.js

const clientRefId = (client) => {
  if (!client) return null;
  if (typeof client === 'object') {
    return client.id || (client._id ? String(client._id) : null);
  }
  return String(client);
};

/**
 * Positional templates (Template 1's shape) are what MSG91 approved with a
 * document header — the whole point of the Form 5 flow, so they always
 * attach the generated PDF. A 'single' mode template targets the generic
 * MSG91 template, which is plain text with no header slot at all — MSG91
 * rejects a document header on it outright, so it must never attach one.
 */
const templateAttachesDocument = (template) =>
  template.bodyMode !== WHATSAPP_BODY_MODES.SINGLE;

/**
 * Send the latest generated Form 5 PDF on WhatsApp via MSG91.
 * Uses the public S3 object URL stored on generatedFile.storedPath.
 * Requires a WhatsApp template to be selected. A text-only (single-body)
 * template sends without the PDF — it has no document header to put it in.
 */
export const sendFilingWhatsApp = async (id, body, actorId) => {
  const filing = await findFilingOrFail(id);

  // Load the selected WhatsApp template (must be active) — its shape decides
  // whether a generated PDF is required at all.
  const template = await whatsappTemplatesService.getActiveTemplateOrFail(
    body.templateId,
  );
  const needsDocument = templateAttachesDocument(template);

  let mediaUrl = null;
  if (needsDocument) {
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

    mediaUrl = String(filing.generatedFile.storedPath || '').trim();
    if (!/^https?:\/\//i.test(mediaUrl)) {
      throw new AppError(
        'Generated file has no public S3 URL. Use S3 storage for WhatsApp send.',
        400,
        { code: FILINGS_CODES.WHATSAPP_MEDIA_URL_MISSING },
      );
    }
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

  const rawRecipientName =
    body?.recipientName !== undefined &&
    body?.recipientName !== null &&
    String(body.recipientName).trim()
      ? String(body.recipientName).trim()
      : String(filing.client?.recipientName ?? '').trim();

  // Build source data for template resolution
  const sourceData = buildWhatsAppSourceData({
    client: filing.client,
    clientCode: filing.clientCode,
    period: filing.period,
    periodLabel: filing.periodLabel,
    recipientName: rawRecipientName,
  });

  // Resolve template with source data + any text typed for custom variables
  const { bodyValues, missing } = resolveWhatsAppMessage(
    template,
    sourceData,
    body?.customValues,
  );

  if (missing.length > 0) {
    throw new AppError(missingFieldsMessage(missing), 400, {
      code: FILINGS_CODES.WHATSAPP_MISSING_FIELDS,
    });
  }

  const clientId = clientRefId(filing.client);
  const shouldSavePhone = body?.savePhone !== false;
  const shouldSaveRecipient = body?.saveRecipientName !== false;
  const clientPatch = {};
  if (shouldSavePhone && clientId && body?.phone !== undefined) {
    clientPatch.contactNumber = String(body.phone).trim() || null;
  }
  if (shouldSaveRecipient && clientId && body?.recipientName !== undefined) {
    clientPatch.recipientName = String(body.recipientName).trim() || null;
  }
  if (clientId && Object.keys(clientPatch).length) {
    await clientsService.updateClient(clientId, clientPatch, actorId);
  }

  const filename = needsDocument
    ? ensurePdfFilename(filing.generatedFile.filename)
    : null;
  const templateSnapshot = toTemplateSnapshot(template);

  const sendLedgerBase = {
    filingId: filing.id,
    clientId,
    clientCode: filing.clientCode,
    companyName: filing.client?.companyName || filing.clientCode || null,
    phone,
    period: filing.period,
    periodLabel: filing.periodLabel || null,
    filename,
    mediaUrl,
    whatsappTemplateId: template.id || template._id,
    templateSnapshot,
    actorId,
  };

  let msg91Response;
  try {
    const result = await sendWhatsAppTemplateBatch({
      template: {
        name: template.msg91TemplateName,
        namespace: template.namespace,
        language: template.languageCode || 'en',
      },
      entries: [
        {
          to: [phone],
          filename,
          mediaUrl,
          bodyValues,
        },
      ],
    });

    // Single-recipient send: check if the one chunk succeeded
    if (!result.chunks?.[0]?.ok) {
      throw new AppError(
        result.chunks?.[0]?.error?.message || 'MSG91 API call failed',
        500,
      );
    }
    msg91Response = result.chunks[0].response;
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
      recipientName: rawRecipientName,
      filename,
      period: filing.period,
      clientCode: filing.clientCode,
      templateLabel: template.label,
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

/**
 * Send multiple Form 5 filings on WhatsApp in one operation.
 * Validates all filings, builds one MSG91 bulk call per chunk, and reports
 * sent/failed/skipped counts with per-filing error details.
 */
export const bulkSendFilingsWhatsApp = async (
  ids,
  templateId,
  actorId,
  customValues = {},
) => {
  // Load template once (must be active) — its shape decides whether a
  // generated PDF is required per filing at all.
  const template = await whatsappTemplatesService.getActiveTemplateOrFail(templateId);
  const templateSnapshot = toTemplateSnapshot(template);
  const needsDocument = templateAttachesDocument(template);

  // Custom text is chosen once for the whole batch, so a missing value is a
  // problem with the send itself — fail up front instead of skipping every row.
  const missingCustom = missingCustomValues(template, customValues);
  if (missingCustom.length > 0) {
    throw new AppError(missingFieldsMessage(missingCustom), 400, {
      code: FILINGS_CODES.WHATSAPP_MISSING_FIELDS,
    });
  }

  // Load all filings
  const filings = await filingsRepository.findFilingsByIds(ids);
  if (filings.length === 0) {
    throw new AppError('No filings found for the provided IDs.', 404, {
      code: FILINGS_CODES.FILING_NOT_FOUND,
    });
  }

  const errors = [];
  const skipped = [];
  const validEntries = [];
  const filingMap = new Map(); // phone -> filing for later lookup

  // Validate each filing and build entries for valid ones
  for (const filing of filings) {
    const clientCode = filing.clientCode || 'N/A';

    // A text-only template has no document header — nothing to generate or
    // attach, so these checks only apply when the template needs one.
    let mediaUrl = null;
    if (needsDocument) {
      if (
        filing.generateStatus !== GENERATE_STATUSES.GENERATED ||
        !filing.generatedFile?.storedPath
      ) {
        skipped.push(filing.id);
        errors.push({
          clientCode,
          message: 'Form 5 not generated',
        });
        continue;
      }

      mediaUrl = String(filing.generatedFile.storedPath || '').trim();
      if (!/^https?:\/\//i.test(mediaUrl)) {
        skipped.push(filing.id);
        errors.push({
          clientCode,
          message: 'No public S3 URL',
        });
        continue;
      }
    }

    // Check phone
    const rawPhone = filing.client?.contactNumber;
    if (!rawPhone) {
      skipped.push(filing.id);
      errors.push({
        clientCode,
        message: 'Missing mobile number',
      });
      continue;
    }

    const phone = normalizeWhatsAppPhone(rawPhone);
    if (!phone) {
      skipped.push(filing.id);
      errors.push({
        clientCode,
        message: 'Invalid mobile number',
      });
      continue;
    }

    // Check recipient name
    const rawRecipientName = String(filing.client?.recipientName ?? '').trim();
    if (!rawRecipientName) {
      skipped.push(filing.id);
      errors.push({
        clientCode,
        message: 'Missing recipient name',
      });
      continue;
    }

    // Build source data and resolve template
    const sourceData = buildWhatsAppSourceData({
      client: filing.client,
      clientCode: filing.clientCode,
      period: filing.period,
      periodLabel: filing.periodLabel,
      recipientName: rawRecipientName,
    });

    const { bodyValues, missing } = resolveWhatsAppMessage(
      template,
      sourceData,
      customValues,
    );

    if (missing.length > 0) {
      skipped.push(filing.id);
      errors.push({
        clientCode,
        message: missingFieldsMessage(missing),
      });
      continue;
    }

    // Valid entry
    const filename = needsDocument
      ? ensurePdfFilename(filing.generatedFile.filename)
      : null;
    validEntries.push({
      filing,
      phone,
      filename,
      mediaUrl,
      bodyValues,
    });
    filingMap.set(phone, filing);
  }

  if (validEntries.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: skipped.length,
      errors,
    };
  }

  // Call MSG91 bulk send (internally chunked)
  let result;
  try {
    result = await sendWhatsAppTemplateBatch({
      template: {
        name: template.msg91TemplateName,
        namespace: template.namespace,
        language: template.languageCode || 'en',
      },
      entries: validEntries.map((entry) => ({
        to: [entry.phone],
        filename: entry.filename,
        mediaUrl: entry.mediaUrl,
        bodyValues: entry.bodyValues,
      })),
    });
  } catch (error) {
    // Entire batch failed - mark all as failed
    for (const entry of validEntries) {
      const filing = entry.filing;
      const clientId = clientRefId(filing.client);

      await recordWhatsAppSend({
        filingId: filing.id,
        clientId,
        clientCode: filing.clientCode,
        companyName: filing.client?.companyName || filing.clientCode || null,
        phone: entry.phone,
        period: filing.period,
        periodLabel: filing.periodLabel || null,
        filename: entry.filename,
        mediaUrl: entry.mediaUrl,
        whatsappTemplateId: template.id || template._id,
        templateSnapshot,
        status: WHATSAPP_SEND_STATUSES.FAILED,
        errorMessage: error?.message || 'Bulk send failed',
        failedAt: new Date(),
        actorId,
      });

      errors.push({
        clientCode: filing.clientCode || 'N/A',
        message: error?.message || 'Bulk send failed',
      });
    }

    return {
      sent: 0,
      failed: validEntries.length,
      skipped: skipped.length,
      errors,
    };
  }

  // Process results per chunk
  let sentCount = 0;
  let failedCount = 0;

  for (const chunk of result.chunks || []) {
    // sendWhatsAppTemplateBatch returns { entries, ok, response, error } per
    // chunk — not a "phones" field — so this always came out empty and every
    // bulk send silently skipped recording, reporting 0 sent / 0 failed no
    // matter what MSG91 actually did.
    const chunkPhones = (chunk.entries || []).flatMap((entry) => entry.to || []);
    const chunkOk = chunk.ok;
    const chunkError = chunk.error;

    for (const phone of chunkPhones) {
      const entry = validEntries.find((e) => e.phone === phone);
      if (!entry) continue;

      const filing = entry.filing;
      const clientId = clientRefId(filing.client);
      const now = new Date();

      const sendLedgerBase = {
        filingId: filing.id,
        clientId,
        clientCode: filing.clientCode,
        companyName: filing.client?.companyName || filing.clientCode || null,
        phone: entry.phone,
        period: filing.period,
        periodLabel: filing.periodLabel || null,
        filename: entry.filename,
        mediaUrl: entry.mediaUrl,
        whatsappTemplateId: template.id || template._id,
        templateSnapshot,
        actorId,
      };

      if (chunkOk) {
        // Chunk succeeded
        filing.sentDate = now;
        filing.mailStatus = 'WhatsApp sent';
        filing.updatedBy = actorId;
        await filingsRepository.saveFiling(filing);

        await recordWhatsAppSend({
          ...sendLedgerBase,
          status: WHATSAPP_SEND_STATUSES.ACCEPTED,
          providerResponse: chunk.response,
          sentAt: now,
        });

        sentCount++;
      } else {
        // Chunk failed
        await recordWhatsAppSend({
          ...sendLedgerBase,
          status: WHATSAPP_SEND_STATUSES.FAILED,
          errorMessage: chunkError?.message || 'Chunk send failed',
          failedAt: now,
        });

        errors.push({
          clientCode: filing.clientCode || 'N/A',
          message: chunkError?.message || 'Chunk send failed',
        });

        failedCount++;
      }
    }
  }

  // Record bulk activity
  await recordActivity({
    action: ACTIVITY_ACTIONS.FILING_BULK_WHATSAPP_SEND,
    entityType: ENTITY_TYPES.FILING,
    changes: {
      templateLabel: template.label,
      sent: sentCount,
      failed: failedCount,
      skipped: skipped.length,
      total: ids.length,
    },
  });

  return {
    sent: sentCount,
    failed: failedCount,
    skipped: skipped.length,
    errors,
  };
};
