import {
  HEADER_SCAN_ROWS,
  PREVIEW_ROW_LIMIT,
  autoMapColumns,
  countDataRows,
  getMappedValue,
  normalizeHeader,
  readWorkbookSheets,
  rowHasAnyValue,
  stringifyCell,
  toHeaders,
} from './masterParse.js';

/**
 * Client-Master workbook: addresses and RC Professional Tax Number keyed
 * by clientno (C0039). Used to fill employer address / RC on Client.
 */

export const CLIENT_MASTER_FIELDS = Object.freeze([
  {
    key: 'clientCode',
    label: 'clientno',
    aliases: ['clientno', 'client no', 'client number', 'client', 'client code'],
    group: 'client',
    required: true,
  },
  {
    key: 'companyName',
    label: 'Company name',
    aliases: ['fname 2', 'fname.2', 'name of company', 'company name'],
    group: 'client',
    required: false,
  },
  {
    key: 'locationName',
    label: 'Location',
    aliases: ['location'],
    group: 'client',
    required: false,
  },
  {
    key: 'address',
    label: 'Address',
    aliases: ['address 1', 'address.1', 'address', 'employer address'],
    group: 'client',
    required: false,
  },
  {
    key: 'rcNumber',
    label: 'RC Professional Tax Number',
    aliases: [
      'rc professional tax number',
      'rc no',
      'rc number',
      'reg no',
      'registration no',
    ],
    group: 'client',
    required: false,
  },
  {
    key: 'status',
    label: 'Group / status',
    aliases: ['fname 1', 'fname.1', 'status'],
    group: 'client',
    required: false,
  },
]);

export const CLIENT_MASTER_REQUIRED_KEYS = Object.freeze(['clientCode']);

const fieldMeta = () =>
  CLIENT_MASTER_FIELDS.map(({ key, label, required, group }) => ({
    key,
    label,
    required,
    group,
  }));

export const looksLikeClientMasterHeader = (cells) => {
  const labels = new Set((cells || []).map(normalizeHeader).filter(Boolean));
  const hasClient =
    labels.has('clientno') ||
    labels.has('client no') ||
    labels.has('client code');
  const hasAddress =
    labels.has('address 1') ||
    labels.has('address') ||
    labels.has('employer address');
  const hasRc =
    labels.has('rc professional tax number') ||
    labels.has('rc no') ||
    labels.has('rc number');
  return hasClient && (hasAddress || hasRc);
};

export const detectClientMasterHeaderRow = (
  rows,
  scanLimit = HEADER_SCAN_ROWS,
) => {
  const limit = Math.min(rows.length, scanLimit);
  for (let index = 0; index < limit; index += 1) {
    if (looksLikeClientMasterHeader(rows[index] || [])) return index;
  }
  return -1;
};

const firstNonEmptyRowIndex = (rows) => {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (rowHasAnyValue(row)) return index;
  }
  return -1;
};

const mappedPreviewRow = (row, mapping, excelRow) => {
  const cells = {};
  for (const field of CLIENT_MASTER_FIELDS) {
    const raw = getMappedValue(row, mapping, field.key);
    cells[field.key] = raw === undefined ? '' : stringifyCell(raw);
  }
  return { excelRow, cells };
};

const emptyParse = (sheetName, warnings) => ({
  sheetName,
  headerRow: null,
  headers: [],
  mapping: autoMapColumns([], CLIENT_MASTER_FIELDS),
  previewRows: [],
  previewRaw: [],
  dataStartIndex: 0,
  rowCount: 0,
  warnings,
  fields: fieldMeta(),
});

export const pickClientMasterSheet = (sheetNames, sheets) => {
  for (const name of sheetNames) {
    if (detectClientMasterHeaderRow(sheets[name] || []) >= 0) return name;
  }
  return sheetNames[0] || null;
};

export const parseClientMasterSheet = (rows, sheetName) => {
  if (!rows?.length) {
    return emptyParse(sheetName, ['This sheet is empty.']);
  }

  const warnings = [];
  let headerIndex = detectClientMasterHeaderRow(rows);
  if (headerIndex < 0) {
    headerIndex = firstNonEmptyRowIndex(rows);
    warnings.push(
      'Could not find a Client-Master header row (clientno + Address / RC Professional Tax Number). Map columns manually.',
    );
  }

  if (headerIndex < 0) {
    return emptyParse(sheetName, ['This sheet is empty.']);
  }

  const headerCells = rows[headerIndex] || [];
  const mapping = autoMapColumns(headerCells, CLIENT_MASTER_FIELDS);
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
    fields: fieldMeta(),
  };
};

export const parseClientMasterWorkbook = (buffer, preferredSheet = null) => {
  const { sheetNames, sheets } = readWorkbookSheets(buffer);
  if (sheetNames.length === 0) {
    throw new Error('Workbook has no sheets');
  }

  const selectedSheet =
    (preferredSheet && sheetNames.includes(preferredSheet)
      ? preferredSheet
      : null) || pickClientMasterSheet(sheetNames, sheets);

  const parsed = parseClientMasterSheet(
    sheets[selectedSheet] || [],
    selectedSheet,
  );

  return {
    sheetNames,
    selectedSheet,
    rowsBySheet: sheets,
    ...parsed,
  };
};
