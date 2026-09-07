import * as XLSX from 'xlsx';

/**
 * MasterSheet header detection, column auto-map, and cell coercions.
 * Templates are data; this file only knows the MasterSheet column aliases.
 */

export const PREVIEW_ROW_LIMIT = 20;
export const HEADER_SCAN_ROWS = 50;
export const ROW_PAGE_MAX = 200;

export const MASTER_FIELDS = Object.freeze([
  {
    key: 'status',
    label: 'Status',
    aliases: ['status'],
    group: 'client',
    required: false,
  },
  {
    key: 'taskNo',
    label: 'Task No.',
    aliases: ['task no', 'task number'],
    group: 'filing',
    required: false,
  },
  {
    key: 'clientCode',
    label: 'Client',
    aliases: ['client', 'client code'],
    group: 'client',
    required: true,
  },
  {
    key: 'companyName',
    label: 'Name of Company',
    aliases: ['name of company', 'company name'],
    group: 'client',
    required: true,
  },
  {
    key: 'draftName',
    label: 'Drafts to be prepared in the name of',
    aliases: ['drafts to be prepared in the name of', 'draft name', 'drafts'],
    group: 'client',
    required: false,
  },
  {
    key: 'locationName',
    label: 'Location',
    aliases: ['location'],
    group: 'client',
    required: true,
  },
  {
    key: 'ptAmount',
    label: 'P.Tax Amount',
    aliases: ['p tax amount', 'ptax amount', 'pt amount'],
    group: 'filing',
    required: false,
  },
  {
    key: 'chequeNo',
    label: 'Ch. No.',
    aliases: ['ch no', 'cheque no', 'cheque number'],
    group: 'filing',
    required: false,
  },
  {
    key: 'sentDate',
    label: 'Sent Date',
    aliases: ['sent date'],
    group: 'filing',
    required: false,
  },
  {
    key: 'challanNo',
    label: 'Challan No.',
    aliases: ['challan no', 'challan number'],
    group: 'filing',
    required: false,
  },
  {
    key: 'challanDate',
    label: 'Dated',
    aliases: ['dated', 'challan date'],
    group: 'filing',
    required: false,
  },
  {
    key: 'rcNumber',
    label: 'Reg No.',
    aliases: ['reg no', 'registration no', 'rc number', 'rc no'],
    group: 'client',
    required: false,
  },
  {
    key: 'contactNumber',
    label: 'Contact Number',
    aliases: ['contact number', 'contact no'],
    group: 'client',
    required: false,
  },
  {
    key: 'fundCode',
    label: 'Fund Code',
    aliases: ['fund code'],
    group: 'client',
    required: false,
  },
  {
    key: 'month',
    label: 'Month',
    aliases: ['month', 'period'],
    group: 'filing',
    required: false,
  },
  {
    key: 'receivedInBank',
    label: 'Received In Bank',
    aliases: ['received in bank'],
    group: 'filing',
    required: false,
  },
  {
    key: 'lessPaymentReceived',
    label: 'Less Payment Received',
    aliases: ['less payment received'],
    group: 'filing',
    required: false,
  },
  {
    key: 'link',
    label: 'Link',
    aliases: ['link'],
    group: 'filing',
    required: false,
  },
  {
    key: 'mailStatus',
    label: 'Mail Status',
    aliases: ['mail status'],
    group: 'filing',
    required: false,
  },
  {
    key: 'originalChallanStatus',
    label: 'Original challan status',
    aliases: ['original challan status'],
    group: 'filing',
    required: false,
  },
]);

export const REQUIRED_MAPPING_KEYS = Object.freeze(
  MASTER_FIELDS.filter((field) => field.required).map((field) => field.key),
);

const MONTH_INDEX = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
});

export const normalizeHeader = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[._]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const stringifyCell = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
};

export const looksLikeMasterHeader = (cells) => {
  const labels = new Set(
    (cells || []).map(normalizeHeader).filter(Boolean),
  );
  const hasClient = labels.has('client') || labels.has('client code');
  const hasCompany =
    labels.has('name of company') || labels.has('company name');
  const hasReg =
    labels.has('reg no') ||
    labels.has('registration no') ||
    labels.has('rc number');
  return hasClient && hasCompany && hasReg;
};

export const detectHeaderRow = (rows, scanLimit = HEADER_SCAN_ROWS) => {
  const limit = Math.min(rows.length, scanLimit);
  for (let index = 0; index < limit; index += 1) {
    if (looksLikeMasterHeader(rows[index] || [])) {
      return index;
    }
  }
  return -1;
};

const firstNonEmptyRowIndex = (rows) => {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (row.some((cell) => stringifyCell(cell) !== '')) return index;
  }
  return -1;
};

export const autoMapColumns = (headerCells, fields = MASTER_FIELDS) => {
  const mapping = {};
  for (const field of fields) mapping[field.key] = null;

  const used = new Set();
  const normalized = (headerCells || []).map((cell, index) => ({
    index,
    label: normalizeHeader(cell),
  }));

  for (const field of fields) {
    const aliases = field.aliases.map(normalizeHeader);
    const match = normalized.find(
      (cell) => cell.label && !used.has(cell.index) && aliases.includes(cell.label),
    );
    if (match) {
      mapping[field.key] = match.index;
      used.add(match.index);
    }
  }

  return mapping;
};

export const extractPhyCode = (companyName) => {
  const match = String(companyName ?? '').match(/\[(\d+)\]\s*$/);
  if (!match) return null;
  return match[1].padStart(4, '0');
};

/** 83, 0083, 83.0 → 0083. Empty / non-numeric → null. */
export const normalizePhyCode = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).padStart(4, '0');
  }
  const digits = stringifyCell(value).replace(/\D/g, '');
  if (!digits) return null;
  return String(Number(digits)).padStart(4, '0');
};

/** Strip branch tags so SMFG … [83] and [84] share one legal company. */
export const legalCompanyName = (companyName) =>
  String(companyName ?? '')
    .replace(/\s*\[\d+\]\s*$/, '')
    .trim();

/**
 * Find Jul-2026 / July-26 / 2026-07 inside a filename or title row.
 */
export const extractPeriodFromText = (text) => {
  const raw = String(text ?? '');
  if (!raw.trim()) return null;

  const iso = raw.match(/(\d{4})-(\d{2})/);
  if (iso) return parsePeriod(iso[0]);

  const named = raw.match(/([A-Za-z]{3,9})\s*[-./]\s*(\d{2,4})/);
  if (named) return parsePeriod(`${named[1]}-${named[2]}`);

  return parsePeriod(raw);
};

const toYearMonth = (year, month) => {
  if (!month || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
};

const parseYearToken = (token) => {
  const year = Number(token);
  if (!Number.isFinite(year)) return null;
  if (year < 100) return 2000 + year;
  return year;
};

/**
 * Accepts Jul-2026, July-26, July.26, 2026-07, or an Excel Date.
 */
export const parsePeriod = (value, fallbackSheetName = '') => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toYearMonth(value.getFullYear(), value.getMonth() + 1);
  }

  const candidates = [stringifyCell(value), String(fallbackSheetName ?? '')];
  for (const raw of candidates) {
    const text = raw.trim();
    if (!text) continue;

    const iso = text.match(/^(\d{4})-(\d{2})$/);
    if (iso) return toYearMonth(Number(iso[1]), Number(iso[2]));

    const named = text.match(/^([A-Za-z]+)\s*[-./]\s*(\d{2,4})$/);
    if (named) {
      const month = MONTH_INDEX[named[1].toLowerCase()];
      const year = parseYearToken(named[2]);
      if (month && year) return toYearMonth(year, month);
    }
  }

  return null;
};

export const parseAmount = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value)
    .replace(/,/g, '')
    .replace(/₹/g, '')
    .trim();
  if (!text) return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
};

export const parseExcelDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = stringifyCell(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const year = parseYearToken(dmy[3]);
    if (!year) return null;
    return new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
  }

  return null;
};

export const toHeaders = (headerCells) =>
  (headerCells || []).map((cell, index) => ({
    index,
    label: stringifyCell(cell) || `Column ${index + 1}`,
  }));

export const getMappedValue = (row, mapping, key) => {
  const index = mapping?.[key];
  if (index === null || index === undefined || index < 0) return undefined;
  return row?.[index];
};

export const rowHasAnyValue = (row) =>
  (row || []).some((cell) => stringifyCell(cell) !== '');

const mappedPreviewRow = (row, mapping, excelRow) => {
  const cells = {};
  for (const field of MASTER_FIELDS) {
    const raw = getMappedValue(row, mapping, field.key);
    cells[field.key] = raw === undefined ? '' : stringifyCell(raw);
  }
  return { excelRow, cells };
};

export const readWorkbookSheets = (buffer) => {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: true,
  });
  const sheets = {};
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      defval: '',
      raw: true,
      blankrows: true,
    });
  }
  return { sheetNames: workbook.SheetNames, sheets };
};

export const pickDefaultSheet = (sheetNames, sheets) => {
  for (const name of sheetNames) {
    if (detectHeaderRow(sheets[name] || []) >= 0) return name;
  }
  return sheetNames[0] || null;
};

export const parseMasterSheet = (rows, sheetName) => {
  const warnings = [];
  if (!rows?.length) {
    return {
      sheetName,
      headerRow: null,
      headers: [],
      mapping: autoMapColumns([]),
      previewRows: [],
      previewRaw: [],
      dataStartIndex: 0,
      rowCount: 0,
      warnings: ['This sheet is empty.'],
      fields: MASTER_FIELDS.map(({ key, label, required, group }) => ({
        key,
        label,
        required,
        group,
      })),
    };
  }

  let headerIndex = detectHeaderRow(rows);
  if (headerIndex < 0) {
    headerIndex = firstNonEmptyRowIndex(rows);
    warnings.push(
      'Could not find a MasterSheet header row (Client + Name of Company + Reg No.). Map columns manually or pick another sheet.',
    );
  }

  if (headerIndex < 0) {
    return {
      sheetName,
      headerRow: null,
      headers: [],
      mapping: autoMapColumns([]),
      previewRows: [],
      previewRaw: [],
      dataStartIndex: 0,
      rowCount: 0,
      warnings: ['This sheet is empty.'],
      fields: MASTER_FIELDS.map(({ key, label, required, group }) => ({
        key,
        label,
        required,
        group,
      })),
    };
  }

  const headerCells = rows[headerIndex] || [];
  const mapping = autoMapColumns(headerCells);
  const dataStartIndex = headerIndex + 1;
  const previewRaw = [];
  const previewRows = [];

  for (
    let index = dataStartIndex;
    index < rows.length && previewRaw.length < PREVIEW_ROW_LIMIT;
    index += 1
  ) {
    const row = rows[index] || [];
    if (!rowHasAnyValue(row)) continue;
    previewRaw.push({
      excelRow: index + 1,
      values: row.map(stringifyCell),
    });
    previewRows.push(mappedPreviewRow(row, mapping, index + 1));
  }

  return {
    sheetName,
    headerRow: headerIndex + 1,
    headers: toHeaders(headerCells),
    mapping,
    previewRows,
    previewRaw,
    dataStartIndex,
    rowCount: countDataRows(rows, dataStartIndex),
    warnings,
    fields: MASTER_FIELDS.map(({ key, label, required, group }) => ({
      key,
      label,
      required,
      group,
    })),
  };
};

export const parseMasterWorkbook = (buffer, preferredSheet = null) => {
  const { sheetNames, sheets } = readWorkbookSheets(buffer);
  if (sheetNames.length === 0) {
    throw new Error('Workbook has no sheets');
  }

  const selectedSheet =
    (preferredSheet && sheetNames.includes(preferredSheet)
      ? preferredSheet
      : null) || pickDefaultSheet(sheetNames, sheets);

  const parsed = parseMasterSheet(sheets[selectedSheet] || [], selectedSheet);
  return {
    sheetNames,
    selectedSheet,
    rowsBySheet: sheets,
    ...parsed,
  };
};

export const iterateDataRows = (rows, dataStartIndex, onRow) => {
  for (let index = dataStartIndex; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (!rowHasAnyValue(row)) continue;
    onRow(row, index + 1);
  }
};

export const countDataRows = (rows, dataStartIndex) => {
  let count = 0;
  iterateDataRows(rows, dataStartIndex, () => {
    count += 1;
  });
  return count;
};

export const mappedCellsForRow = (row, mapping, fields) => {
  const cells = {};
  for (const field of fields) {
    const raw = getMappedValue(row, mapping, field.key);
    cells[field.key] = raw === undefined ? '' : stringifyCell(raw);
  }
  return cells;
};

export const collectMappedDataRows = (rows, dataStartIndex, mapping, fields) => {
  const result = [];
  iterateDataRows(rows, dataStartIndex, (row, excelRow) => {
    result.push({
      excelRow,
      cells: mappedCellsForRow(row, mapping, fields),
    });
  });
  return result;
};

export const mappingHasRequiredFields = (
  mapping,
  keys = REQUIRED_MAPPING_KEYS,
) =>
  keys.every(
    (key) => typeof mapping?.[key] === 'number' && mapping[key] >= 0,
  );
