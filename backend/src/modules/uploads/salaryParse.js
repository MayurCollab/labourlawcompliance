import {
  HEADER_SCAN_ROWS,
  PREVIEW_ROW_LIMIT,
  autoMapColumns,
  countDataRows,
  extractPeriodFromText,
  mappedCellsForRow,
  normalizeHeader,
  parsePeriod,
  readWorkbookSheets,
  rowHasAnyValue,
  stringifyCell,
  toFieldMeta,
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
    key: 'clientCode',
    label: 'ClientID',
    aliases: [
      'clientid',
      'client id',
      'client',
      'client code',
      'clientno',
      'client no',
      'client number',
    ],
    group: 'employee',
    required: false,
    preview: true,
  },
  {
    key: 'companyName',
    label: 'Company Name',
    aliases: ['company name', 'name of company'],
    group: 'employee',
    required: false,
    preview: true,
  },
  {
    key: 'employeeNo',
    label: 'EMPNO',
    aliases: ['empno', 'emp no', 'employee no', 'employee number'],
    group: 'employee',
    required: true,
    preview: true,
  },
  {
    key: 'employeeName',
    label: 'EMP_NAME',
    aliases: ['emp name', 'employee name', 'name'],
    group: 'employee',
    required: false,
    preview: true,
    previewLabel: 'Employee name',
  },
  {
    key: 'locationName',
    label: 'LOCATION',
    aliases: ['location'],
    group: 'employee',
    required: false,
    preview: true,
    previewLabel: 'Location',
  },
  {
    key: 'state',
    label: 'STATE',
    aliases: ['state'],
    group: 'employee',
    required: false,
    preview: true,
    previewLabel: 'State',
    defaultValue: 'Gujarat',
  },
  {
    key: 'ptGross',
    label: 'PT GROSS',
    aliases: ['pt gross', 'ptgross'],
    group: 'employee',
    required: false,
  },
  {
    key: 'phyCode',
    label: 'PHY_CODE',
    aliases: ['phy code', 'phycode'],
    group: 'employee',
    required: false,
  },
  {
    key: 'pTax',
    label: 'P_TAX',
    aliases: ['p tax', 'ptax', 'pt tax'],
    group: 'employee',
    required: false,
    preview: true,
    previewLabel: 'P.tax',
  },
]);

export const SALARY_REQUIRED_KEYS = Object.freeze(['employeeNo']);

const fieldMeta = () => toFieldMeta(SALARY_FIELDS);

export const looksLikeSalaryHeader = (cells) => {
  const labels = new Set((cells || []).map(normalizeHeader).filter(Boolean));
  return (
    labels.has('empno') ||
    labels.has('emp no') ||
    labels.has('employee no')
  );
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

const mappedPreviewRow = (row, mapping, excelRow) => ({
  excelRow,
  cells: mappedCellsForRow(row, mapping, SALARY_FIELDS),
});

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
      'Could not find a salary header row (EMPNO + PT GROSS). Map columns manually or pick the OutPut sheet.',
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
