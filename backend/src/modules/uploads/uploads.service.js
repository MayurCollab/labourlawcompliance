import path from 'node:path';

import AppError from '../../utils/AppError.js';
import storage from '../../storage/index.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as clientsService from '../clients/clients.service.js';
import * as employeesService from '../employees/employees.service.js';
import * as filingsService from '../filings/filings.service.js';
import {
  getMappedValue,
  iterateDataRows,
  mappingHasRequiredFields,
  MASTER_FIELDS,
  parseMasterWorkbook,
  parsePeriod,
  REQUIRED_MAPPING_KEYS,
  stringifyCell,
  collectMappedDataRows,
  ROW_PAGE_MAX,
} from './masterParse.js';
import {
  parseSalaryWorkbook,
  SALARY_FIELDS,
  SALARY_REQUIRED_KEYS,
  salaryMappingHasIdentity,
} from './salaryParse.js';
import {
  CLIENT_MASTER_FIELDS,
  CLIENT_MASTER_REQUIRED_KEYS,
  parseClientMasterWorkbook,
} from './clientMasterParse.js';
import {
  buildImportErrorWorkbook,
  hasImportErrors,
  importErrorFilename,
} from './importErrorWorkbook.js';
import {
  createClientImportCache,
  createSalaryMatchCache,
  loadFilingsIntoCache,
} from './importCache.js';
import {
  EXCEL_EXTENSIONS,
  UPLOAD_KINDS,
  UPLOAD_STATUSES,
  UPLOADS_CODES,
} from './uploads.constants.js';
import { toUploadDetailDto, toUploadList } from './uploads.dto.js';
import * as uploadsRepository from './uploads.repository.js';
import {
  purgeClientMasterData as runPurgeClientMaster,
  purgeMasterData as runPurgeMaster,
  purgeSalaryData as runPurgeSalary,
} from './uploadsPurge.js';

const applyParse = (upload, parsed) => {
  upload.sheetNames = parsed.sheetNames;
  upload.selectedSheet = parsed.selectedSheet;
  upload.headerRow = parsed.headerRow;
  upload.headers = parsed.headers;
  upload.mapping = parsed.mapping;
  upload.fields = parsed.fields;
  upload.previewRows = parsed.previewRows;
  upload.previewRaw = parsed.previewRaw;
  upload.warnings = parsed.warnings;
  upload.rowCount = parsed.rowCount ?? 0;
  if (parsed.suggestedPeriod) {
    upload.suggestedPeriod = parsed.suggestedPeriod;
  }
  upload.error = null;
};

const findUploadOrFail = async (id, { withPath = false } = {}) => {
  const upload = withPath
    ? await uploadsRepository.findUploadByIdWithPath(id)
    : await uploadsRepository.findUploadById(id);
  if (!upload) {
    throw new AppError('Upload not found', 404, {
      code: UPLOADS_CODES.UPLOAD_NOT_FOUND,
    });
  }
  return upload;
};

const assertExcelFile = (originalName) => {
  const extension = path.extname(originalName || '').toLowerCase();
  if (!EXCEL_EXTENSIONS.includes(extension)) {
    throw new AppError(
      'Workbook must be an Excel file (.xlsx, .xlsm, .xls)',
      422,
      { code: UPLOADS_CODES.INVALID_KIND },
    );
  }
};

const parseBuffer = (kind, buffer, sheetName = null, originalName = '') => {
  try {
    if (kind === UPLOAD_KINDS.SALARY) {
      return parseSalaryWorkbook(buffer, sheetName, originalName);
    }
    if (kind === UPLOAD_KINDS.CLIENT_MASTER) {
      return parseClientMasterWorkbook(buffer, sheetName);
    }
    return parseMasterWorkbook(buffer, sheetName);
  } catch (error) {
    throw new AppError(
      error?.message || 'Could not parse this workbook',
      422,
      { code: UPLOADS_CODES.PARSE_FAILED },
    );
  }
};

const fieldsForKind = (kind) => {
  if (kind === UPLOAD_KINDS.SALARY) return SALARY_FIELDS;
  if (kind === UPLOAD_KINDS.CLIENT_MASTER) return CLIENT_MASTER_FIELDS;
  return MASTER_FIELDS;
};

const readUploadBuffer = async (upload) => {
  const storedPath = upload.storedPath;
  if (!storedPath) {
    throw new AppError('Upload file is no longer on disk', 404, {
      code: UPLOADS_CODES.UPLOAD_NOT_FOUND,
    });
  }
  return storage.readFileBuffer(storedPath);
};

const buildRowFields = (row, mapping, fields) => {
  const values = {};
  for (const field of fields) {
    const raw = getMappedValue(row, mapping, field.key);
    if (raw === undefined) continue;
    values[field.key] = raw;
  }
  return values;
};

export const listUploads = async (query) => {
  const { page, limit, kind, sortBy, sortOrder } = query;
  const filter = {};
  if (kind) filter.kind = kind;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [uploads, total] = await Promise.all([
    uploadsRepository.findUploads(filter, { sort, skip, limit }),
    uploadsRepository.countUploads(filter),
  ]);

  return {
    uploads: toUploadList(uploads),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getUpload = async (id) => {
  const upload = await findUploadOrFail(id);
  return toUploadDetailDto(upload);
};

export const listUploadRows = async (id, body = {}) => {
  const upload = await findUploadOrFail(id, { withPath: true });
  const buffer = await readUploadBuffer(upload);
  const selectedSheet = body.sheetName || upload.selectedSheet;
  const parsed = parseBuffer(
    upload.kind,
    buffer,
    selectedSheet,
    upload.originalName,
  );

  if (selectedSheet && parsed.selectedSheet !== selectedSheet) {
    throw new AppError('That sheet is not in this workbook', 422, {
      code: UPLOADS_CODES.INVALID_SHEET,
    });
  }

  const mapping = body.mapping || parsed.mapping || upload.mapping;
  const fields = fieldsForKind(upload.kind);
  const rows = parsed.rowsBySheet[parsed.selectedSheet] || [];
  const mapped = collectMappedDataRows(
    rows,
    parsed.dataStartIndex,
    mapping,
    fields,
  );

  let enriched = mapped;
  let extraFields = [];
  if (upload.kind === UPLOAD_KINDS.SALARY) {
    const clients = await clientsRepository.findAllCompact();
    extraFields = [
      {
        key: 'matchedClientCode',
        label: 'Matched client',
        required: false,
        group: 'employee',
      },
      {
        key: 'matchedCompanyName',
        label: 'Matched company',
        required: false,
        group: 'employee',
      },
    ];
    enriched = mapped.map((row) => {
      const match = employeesService.matchClientForSalaryRow(clients, {
        phyCode: row.cells.phyCode,
        clientCode: row.cells.clientCode,
        companyName: body.companyName || upload.companyName || '',
      });
      return {
        excelRow: row.excelRow,
        cells: {
          ...row.cells,
          matchedClientCode: match.client?.clientCode || '',
          matchedCompanyName: match.client?.companyName || '',
        },
        unmatched: !match.client,
        unmatchedReason: match.reason || null,
      };
    });
  }

  const page = Math.max(1, Number(body.page) || 1);
  const limit = Math.min(
    ROW_PAGE_MAX,
    Math.max(1, Number(body.limit) || 50),
  );
  const total = enriched.length;
  const start = (page - 1) * limit;

  return {
    kind: upload.kind,
    selectedSheet: parsed.selectedSheet,
    mapping,
    fields: [...fields.map(({ key, label, required, group }) => ({
      key,
      label,
      required,
      group,
    })), ...extraFields],
    rows: enriched.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    },
  };
};

export const createUpload = async ({ file, kind }, actorId) => {
  if (!file?.buffer) {
    throw new AppError('A file is required', 422, {
      code: UPLOADS_CODES.FILE_REQUIRED,
    });
  }

  const uploadKind = kind || UPLOAD_KINDS.MASTER;
  assertExcelFile(file.originalname);

  const stored = await storage.saveDocument({
    buffer: file.buffer,
    mimetype: file.mimetype,
    folder: 'documents',
    originalName: file.originalname,
  });

  let parsed;
  try {
    parsed = parseBuffer(
      uploadKind,
      file.buffer,
      null,
      file.originalname,
    );
  } catch (error) {
    await storage.deleteFile(stored.path);
    throw error;
  }

  const upload = await uploadsRepository.createUpload({
    kind: uploadKind,
    originalName: stored.originalName,
    storedPath: stored.path,
    mimetype: stored.mimetype,
    size: stored.size,
    status: UPLOAD_STATUSES.UPLOADED,
    createdBy: actorId,
  });

  applyParse(upload, parsed);
  await uploadsRepository.saveUpload(upload);

  return toUploadDetailDto(await findUploadOrFail(upload.id));
};

export const previewUpload = async (id, { sheetName }) => {
  const upload = await findUploadOrFail(id, { withPath: true });
  const buffer = await readUploadBuffer(upload);
  const parsed = parseBuffer(
    upload.kind,
    buffer,
    sheetName,
    upload.originalName,
  );

  if (sheetName && parsed.selectedSheet !== sheetName) {
    throw new AppError('That sheet is not in this workbook', 422, {
      code: UPLOADS_CODES.INVALID_SHEET,
    });
  }

  applyParse(upload, parsed);
  upload.status =
    upload.status === UPLOAD_STATUSES.IMPORTED
      ? UPLOAD_STATUSES.IMPORTED
      : UPLOAD_STATUSES.PREVIEWED;
  await uploadsRepository.saveUpload(upload);

  return toUploadDetailDto(await findUploadOrFail(id));
};

const emitImportProgress = (onProgress, snapshot) => {
  if (typeof onProgress === 'function') {
    onProgress(snapshot);
  }
};

/** Throttle progress events so large sheets do not flood the NDJSON stream. */
const makeProgressEmitter = (onProgress, every = 25) => {
  let lastEmitted = 0;
  return (snapshot, force = false) => {
    const processed = snapshot.processed ?? 0;
    const total = snapshot.total ?? 0;
    const isDone = total > 0 && processed >= total;
    if (
      !force &&
      !isDone &&
      processed - lastEmitted < every &&
      processed !== 0
    ) {
      return;
    }
    lastEmitted = processed;
    emitImportProgress(onProgress, snapshot);
  };
};

const importMaster = async (
  upload,
  { sheetName, mapping },
  actorId,
  onProgress,
) => {
  if (!mappingHasRequiredFields(mapping, REQUIRED_MAPPING_KEYS)) {
    throw new AppError(
      'Map Client, Name of Company, and Location before saving',
      422,
      { code: UPLOADS_CODES.MAPPING_INCOMPLETE },
    );
  }

  const buffer = await readUploadBuffer(upload);
  const selectedSheet = sheetName || upload.selectedSheet;
  const parsed = parseBuffer(UPLOAD_KINDS.MASTER, buffer, selectedSheet);

  if (selectedSheet && parsed.selectedSheet !== selectedSheet) {
    throw new AppError('That sheet is not in this workbook', 422, {
      code: UPLOADS_CODES.INVALID_SHEET,
    });
  }

  const rows = parsed.rowsBySheet[selectedSheet] || [];
  const report = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
    unmatched: [],
    filings: { inserted: 0, updated: 0, unchanged: 0 },
  };

  const dataRows = [];
  iterateDataRows(rows, parsed.dataStartIndex, (row, excelRow) => {
    dataRows.push({ row, excelRow });
  });

  const periods = new Set();
  for (const { row } of dataRows) {
    const fields = buildRowFields(row, mapping, MASTER_FIELDS);
    const period = parsePeriod(fields.month, selectedSheet);
    if (period) periods.add(period);
  }

  const cache = await createClientImportCache();
  await loadFilingsIntoCache(cache, [...periods]);

  const total = dataRows.length;
  let processed = 0;
  const emit = makeProgressEmitter(onProgress);

  for (const { row, excelRow } of dataRows) {
    const fields = buildRowFields(row, mapping, MASTER_FIELDS);
    const clientResult = await clientsService.upsertFromMasterRow(
      {
        clientCode: fields.clientCode,
        companyName: fields.companyName,
        locationName: fields.locationName,
        draftName: fields.draftName,
        rcNumber: fields.rcNumber,
        contactNumber: fields.contactNumber,
        fundCode: fields.fundCode,
        status: fields.status,
      },
      actorId,
      cache,
    );

    if (clientResult.outcome === 'skipped') {
      report.skipped.push({ row: excelRow, reason: clientResult.reason });
    } else {
      if (clientResult.outcome === 'inserted') report.inserted += 1;
      if (clientResult.outcome === 'updated') report.updated += 1;
      if (clientResult.outcome === 'unchanged') report.unchanged += 1;

      const periodLabel =
        stringifyCell(fields.month) || selectedSheet || '';
      const period = parsePeriod(fields.month, selectedSheet);
      const filingResult = await filingsService.upsertFromMasterRow({
        client: clientResult.client,
        fields,
        period,
        periodLabel,
        actorId,
        cache,
      });

      if (filingResult.outcome === 'skipped') {
        report.skipped.push({ row: excelRow, reason: filingResult.reason });
      } else {
        if (filingResult.outcome === 'inserted') report.filings.inserted += 1;
        if (filingResult.outcome === 'updated') report.filings.updated += 1;
        if (filingResult.outcome === 'unchanged') report.filings.unchanged += 1;
      }
    }

    processed += 1;
    emit({
      phase: 'import',
      processed,
      total,
      inserted: report.inserted,
      updated: report.updated,
      unchanged: report.unchanged,
      skipped: report.skipped.length,
      unmatched: report.unmatched.length,
      filings: report.filings,
    });
  }

  emit(
    {
      phase: 'rematch',
      processed: total,
      total,
      inserted: report.inserted,
      updated: report.updated,
      unchanged: report.unchanged,
      skipped: report.skipped.length,
      unmatched: report.unmatched.length,
      filings: report.filings,
    },
    true,
  );

  report.rematchedEmployees =
    await employeesService.rematchUnmatchedEmployees(actorId);

  return { parsed, selectedSheet, report };
};

const importSalary = async (
  upload,
  { sheetName, mapping, period, companyName },
  actorId,
  onProgress,
) => {
  if (!mappingHasRequiredFields(mapping, SALARY_REQUIRED_KEYS)) {
    throw new AppError(
      'Map EMPNO and PT GROSS before saving',
      422,
      { code: UPLOADS_CODES.MAPPING_INCOMPLETE },
    );
  }
  if (!salaryMappingHasIdentity(mapping)) {
    throw new AppError(
      'Map PHY_CODE or Client code so employees can be matched to a client',
      422,
      { code: UPLOADS_CODES.IDENTITY_REQUIRED },
    );
  }

  const resolvedPeriod =
    period || upload.period || upload.suggestedPeriod || null;
  if (!resolvedPeriod) {
    throw new AppError(
      'Select the salary period (YYYY-MM) before importing',
      422,
      { code: UPLOADS_CODES.PERIOD_REQUIRED },
    );
  }

  const buffer = await readUploadBuffer(upload);
  const selectedSheet = sheetName || upload.selectedSheet;
  const parsed = parseBuffer(
    UPLOAD_KINDS.SALARY,
    buffer,
    selectedSheet,
    upload.originalName,
  );

  if (selectedSheet && parsed.selectedSheet !== selectedSheet) {
    throw new AppError('That sheet is not in this workbook', 422, {
      code: UPLOADS_CODES.INVALID_SHEET,
    });
  }

  const cache = await createSalaryMatchCache(resolvedPeriod);
  const rows = parsed.rowsBySheet[selectedSheet] || [];
  const report = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
    unmatched: [],
  };

  const dataRows = [];
  iterateDataRows(rows, parsed.dataStartIndex, (row, excelRow) => {
    dataRows.push({ row, excelRow });
  });

  const total = dataRows.length;
  let processed = 0;
  const emit = makeProgressEmitter(onProgress);

  for (const { row, excelRow } of dataRows) {
    const fields = buildRowFields(row, mapping, SALARY_FIELDS);
    const result = await employeesService.upsertFromSalaryRow({
      fields,
      period: resolvedPeriod,
      periodLabel: resolvedPeriod,
      clients: cache.clients,
      companyName: companyName || upload.companyName || '',
      uploadId: upload.id,
      actorId,
      cache,
    });

    if (result.outcome === 'skipped') {
      report.skipped.push({ row: excelRow, reason: result.reason });
    } else if (result.outcome === 'unmatched') {
      report.unmatched.push({
        row: excelRow,
        employeeNo: stringifyCell(fields.employeeNo),
        phyCode: stringifyCell(fields.phyCode),
        clientCode: stringifyCell(fields.clientCode),
        reason: result.reason,
      });
    } else {
      if (result.outcome === 'inserted') report.inserted += 1;
      if (result.outcome === 'updated') report.updated += 1;
      if (result.outcome === 'unchanged') report.unchanged += 1;
    }

    processed += 1;
    emit({
      phase: 'import',
      processed,
      total,
      inserted: report.inserted,
      updated: report.updated,
      unchanged: report.unchanged,
      skipped: report.skipped.length,
      unmatched: report.unmatched.length,
    });
  }

  upload.period = resolvedPeriod;
  upload.companyName = companyName || upload.companyName || null;

  return { parsed, selectedSheet, report };
};

const importClientMaster = async (
  upload,
  { sheetName, mapping },
  actorId,
  onProgress,
) => {
  if (!mappingHasRequiredFields(mapping, CLIENT_MASTER_REQUIRED_KEYS)) {
    throw new AppError('Map clientno before saving', 422, {
      code: UPLOADS_CODES.MAPPING_INCOMPLETE,
    });
  }

  const buffer = await readUploadBuffer(upload);
  const selectedSheet = sheetName || upload.selectedSheet;
  const parsed = parseBuffer(
    UPLOAD_KINDS.CLIENT_MASTER,
    buffer,
    selectedSheet,
  );

  if (selectedSheet && parsed.selectedSheet !== selectedSheet) {
    throw new AppError('That sheet is not in this workbook', 422, {
      code: UPLOADS_CODES.INVALID_SHEET,
    });
  }

  const cache = await createClientImportCache();
  const rows = parsed.rowsBySheet[selectedSheet] || [];
  const report = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
    unmatched: [],
  };

  const dataRows = [];
  iterateDataRows(rows, parsed.dataStartIndex, (row, excelRow) => {
    dataRows.push({ row, excelRow });
  });

  const total = dataRows.length;
  let processed = 0;
  const emit = makeProgressEmitter(onProgress);

  for (const { row, excelRow } of dataRows) {
    const fields = buildRowFields(row, mapping, CLIENT_MASTER_FIELDS);
    const result = await clientsService.upsertFromClientMasterRow(
      fields,
      actorId,
      cache,
    );

    if (result.outcome === 'skipped') {
      report.skipped.push({ row: excelRow, reason: result.reason });
    } else {
      if (result.outcome === 'inserted') report.inserted += 1;
      if (result.outcome === 'updated') report.updated += 1;
      if (result.outcome === 'unchanged') report.unchanged += 1;
    }

    processed += 1;
    emit({
      phase: 'import',
      processed,
      total,
      inserted: report.inserted,
      updated: report.updated,
      unchanged: report.unchanged,
      skipped: report.skipped.length,
      unmatched: report.unmatched.length,
    });
  }

  emit(
    {
      phase: 'rematch',
      processed: total,
      total,
      inserted: report.inserted,
      updated: report.updated,
      unchanged: report.unchanged,
      skipped: report.skipped.length,
      unmatched: report.unmatched.length,
    },
    true,
  );

  report.rematchedEmployees =
    await employeesService.rematchUnmatchedEmployees(actorId);

  return { parsed, selectedSheet, report };
};

export const importUpload = async (id, body, actorId, onProgress) => {
  const upload = await findUploadOrFail(id, { withPath: true });
  let imported;
  if (upload.kind === UPLOAD_KINDS.SALARY) {
    imported = await importSalary(upload, body, actorId, onProgress);
  } else if (upload.kind === UPLOAD_KINDS.CLIENT_MASTER) {
    imported = await importClientMaster(upload, body, actorId, onProgress);
  } else {
    imported = await importMaster(upload, body, actorId, onProgress);
  }

  const { parsed, selectedSheet, report } = imported;

  upload.selectedSheet = selectedSheet;
  upload.mapping = body.mapping;
  upload.headerRow = parsed.headerRow;
  upload.headers = parsed.headers;
  upload.previewRows = parsed.previewRows;
  upload.previewRaw = parsed.previewRaw;
  upload.warnings = parsed.warnings;
  upload.fields = parsed.fields;
  upload.rowCount = parsed.rowCount ?? 0;
  if (parsed.suggestedPeriod) {
    upload.suggestedPeriod = parsed.suggestedPeriod;
  }
  upload.report = report;
  upload.status = UPLOAD_STATUSES.IMPORTED;
  upload.error = null;
  upload.updatedBy = actorId;
  await uploadsRepository.saveUpload(upload);

  await recordActivity({
    action: ACTIVITY_ACTIONS.UPLOAD_IMPORT,
    entityType: ENTITY_TYPES.UPLOAD,
    entityId: upload.id,
    changes: {
      kind: upload.kind,
      originalName: upload.originalName,
      sheetName: selectedSheet,
      period: upload.period,
      inserted: report.inserted,
      updated: report.updated,
      unchanged: report.unchanged,
      skipped: report.skipped.length,
      unmatched: report.unmatched.length,
      filings: report.filings,
    },
  });

  return {
    upload: toUploadDetailDto(await findUploadOrFail(id)),
    report,
  };
};

export const downloadImportErrors = async (id) => {
  const upload = await findUploadOrFail(id);
  if (!hasImportErrors(upload.report)) {
    throw new AppError('This import has no skipped or unmatched rows', 404, {
      code: UPLOADS_CODES.NO_IMPORT_ERRORS,
    });
  }

  return {
    buffer: buildImportErrorWorkbook(upload.report),
    filename: importErrorFilename(upload.originalName),
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
};

export const purgeMasterData = async (body, actorId) => {
  const result = await runPurgeMaster(body, actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.UPLOAD_PURGE_MASTER,
    entityType: ENTITY_TYPES.UPLOAD,
    entityId: actorId,
    changes: result,
  });

  return result;
};

export const purgeSalaryData = async (body, actorId) => {
  const result = await runPurgeSalary(body, actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.UPLOAD_PURGE_SALARY,
    entityType: ENTITY_TYPES.UPLOAD,
    entityId: actorId,
    changes: result,
  });

  return result;
};

export const purgeClientMasterData = async (body, actorId) => {
  const result = await runPurgeClientMaster(body, actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.UPLOAD_PURGE_CLIENT_MASTER,
    entityType: ENTITY_TYPES.UPLOAD,
    entityId: actorId,
    changes: result,
  });

  return result;
};
