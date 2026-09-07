import * as XLSX from 'xlsx';

const skippedRows = (report) =>
  Array.isArray(report?.skipped) ? report.skipped : [];

const unmatchedRows = (report) =>
  Array.isArray(report?.unmatched) ? report.unmatched : [];

/** True when the last import left skipped or unmatched rows to review. */
export const hasImportErrors = (report) =>
  skippedRows(report).length > 0 || unmatchedRows(report).length > 0;

export const importErrorFilename = (originalName = 'import') => {
  const stem = String(originalName || 'import')
    .replace(/\.[^.\\/]+$/, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 140);
  return `${stem || 'import'}_errors.xlsx`;
};

/**
 * Tiny Excel of skipped + unmatched rows so staff can share failed lines
 * without re-opening the original workbook.
 */
export const buildImportErrorWorkbook = (report = {}) => {
  const workbook = XLSX.utils.book_new();

  const skippedAoa = [
    ['Excel row', 'Reason'],
    ...skippedRows(report).map((row) => [row.row ?? '', row.reason ?? '']),
  ];
  const unmatchedAoa = [
    ['Excel row', 'EMPNO', 'PHY_CODE', 'Reason'],
    ...unmatchedRows(report).map((row) => [
      row.row ?? '',
      row.employeeNo ?? '',
      row.phyCode ?? '',
      row.reason ?? '',
    ]),
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(skippedAoa),
    'Skipped',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(unmatchedAoa),
    'Unmatched',
  );

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
