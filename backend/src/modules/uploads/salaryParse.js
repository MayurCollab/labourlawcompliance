import {
  HEADER_SCAN_ROWS,
  PREVIEW_ROW_LIMIT,
  autoMapColumns,
  countDataRows,
  extractPeriodFromText,
  getMappedValue,
  normalizeHeader,
  parsePeriod,
  readWorkbookSheets,
  rowHasAnyValue,
  stringifyCell,
  toHeaders,
} from './masterParse.js';

/**
 * Salary OutPut header detection and auto-map.
 * Sheet2 pivots are skipped as the default import sheet.
 */

export const SALARY_FIELDS = Object.freeze([
  {
    key: 'srNo',
    label: 'SRNO',
    aliases: ['srno', 'sr no', 's no'],
    group: 'employee',
    required: false,
  },
  {
    key: 'employeeNo',
    label: 'EMPNO',
    aliases: ['empno', 'emp no', 'employee no', 'employee number'],
    group: 'employee',
    required: true,
  },
  {
    key: 'employeeName',
    label: 'EMP_NAME',
    aliases: ['emp name', 'employee name', 'name'],
    group: 'employee',
    required: false,
  },
  {
    key: 'locationName',
    label: 'LOCATION',
    aliases: ['location'],
    group: 'employee',
    required: false,
  },
  {
    key: 'state',
    label: 'STATE',
    aliases: ['state'],
    group: 'employee',
    required: false,
  },
  {
    key: 'ptGross',
    label: 'PT GROSS',
    aliases: ['pt gross', 'ptgross'],
    group: 'employee',
    required: true,
  },
  {
    key: 'phyCode',
    label: 'PHY_CODE',
    aliases: ['phy code', 'phycode'],
    group: 'employee',
    required: false,
  },
  {
    key: 'clientCode',
    label: 'Client code',
    aliases: ['client', 'client code', 'clientno', 'client no', 'client number'],
    group: 'employee',
    required: false,
  },
  {
    key: 'pTax',
    label: 'P_TAX',
    aliases: ['p tax', 'ptax', 'pt tax'],
    group: 'employee',
    required: false,
  },
]);

export const SALARY_REQUIRED_KEYS = Object.freeze(['employeeNo', 'ptGross']);

export const salaryMappingHasIdentity = (mapping) => {
  const hasPhy =
    typeof mapping?.phyCode === 'number' && mapping.phyCode >= 0;
  const hasClient =
    typeof mapping?.clientCode === 'number' && mapping.clientCode >= 0;
  return hasPhy || hasClient;
};

const fieldMeta = () =>
  SALARY_FIELDS.map(({ key, label, required, group }) => ({
    key,
    label,
    required,
    group,
  }));

export const looksLikeSalaryHeader = (cells) => {
  const labels = new Set((cells || []).map(normalizeHeader).filter(Boolean));
  const hasEmp =
    labels.has('empno') ||
    labels.has('emp no') ||
    labels.has('employee no');
  const hasPhy = labels.has('phy code') || labels.has('phycode');
  const hasClient =
    labels.has('client') ||
    labels.has('client code') ||
    labels.has('clientno') ||
    labels.has('client no');
  const hasAmount =
    labels.has('pt gross') ||
    labels.has('ptgross') ||
    labels.has('p tax') ||
    labels.has('ptax');
  return hasEmp && hasAmount && (hasPhy || hasClient);
};

export const detectSalaryHeaderRow = (rows, scanLimit = HEADER_SCAN_ROWS) => {
  const limit = Math.min(rows.length, scanLimit);
  for (let index = 0; index < limit; index += 1) {
    if (looksLikeSalaryHeader(rows[index] || [])) return index;
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

const isOutputSheet = (name) =>
  String(name ?? '')
    .replace(/\s+/g, '')
    .toLowerCase() === 'output';

const isPivotSheet = (name) => /^sheet2$/i.test(String(name ?? '').trim());

export const pickSalarySheet = (sheetNames, sheets) => {
  const output = sheetNames.find(isOutputSheet);
  if (output && detectSalaryHeaderRow(sheets[output] || []) >= 0) {
    return output;
  }

  for (const name of sheetNames) {
    if (isPivotSheet(name)) continue;
    if (detectSalaryHeaderRow(sheets[name] || []) >= 0) return name;
  }

  return output || sheetNames[0] || null;
};

const mappedPreviewRow = (row, mapping, excelRow) => {
  const cells = {};
  for (const field of SALARY_FIELDS) {
    const raw = getMappedValue(row, mapping, field.key);
    cells[field.key] = raw === undefined ? '' : stringifyCell(raw);
  }
  return { excelRow, cells };
};

const emptyParse = (sheetName, warnings) => ({
  sheetName,
  headerRow: null,
  headers: [],
  mapping: autoMapColumns([], SALARY_FIELDS),
  previewRows: [],
  previewRaw: [],
  dataStartIndex: 0,
  rowCount: 0,
  warnings,
  fields: fieldMeta(),
  suggestedPeriod: null,
});

export const parseSalarySheet = (rows, sheetName, originalName = '') => {
  if (!rows?.length) {
    return emptyParse(sheetName, ['This sheet is empty.']);
  }

  const warnings = [];
  let headerIndex = detectSalaryHeaderRow(rows);
  if (headerIndex < 0) {
    headerIndex = firstNonEmptyRowIndex(rows);
    warnings.push(
      'Could not find a salary header row (EMPNO + PT GROSS + PHY_CODE or Client). Map columns manually or pick the OutPut sheet.',
    );
  }

  if (headerIndex < 0) {
    return emptyParse(sheetName, ['This sheet is empty.']);
  }

  const headerCells = rows[headerIndex] || [];
  const mapping = autoMapColumns(headerCells, SALARY_FIELDS);
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

  const titleText = [
    originalName,
    sheetName,
    ...(rows.slice(0, headerIndex + 1) || []).map((row) =>
      (row || []).map(stringifyCell).join(' '),
    ),
  ].join(' ');

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
    suggestedPeriod:
      extractPeriodFromText(originalName) ||
      extractPeriodFromText(titleText) ||
      parsePeriod('', sheetName),
  };
};

export const parseSalaryWorkbook = (
  buffer,
  preferredSheet = null,
  originalName = '',
) => {
  const { sheetNames, sheets } = readWorkbookSheets(buffer);
  if (sheetNames.length === 0) {
    throw new Error('Workbook has no sheets');
  }

  const selectedSheet =
    (preferredSheet && sheetNames.includes(preferredSheet)
      ? preferredSheet
      : null) || pickSalarySheet(sheetNames, sheets);

  const parsed = parseSalarySheet(
    sheets[selectedSheet] || [],
    selectedSheet,
    originalName,
  );

  if (isPivotSheet(selectedSheet)) {
    parsed.warnings = [
      ...parsed.warnings,
      'Sheet2 is a pivot, not the employee dump. Prefer the OutPut sheet.',
    ];
  }

  return {
    sheetNames,
    selectedSheet,
    rowsBySheet: sheets,
    ...parsed,
  };
};
