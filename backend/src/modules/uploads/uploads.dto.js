const toParseDto = (upload) => ({
  sheetNames: upload.sheetNames || [],
  selectedSheet: upload.selectedSheet,
  headerRow: upload.headerRow,
  headers: upload.headers || [],
  mapping: upload.mapping || {},
  fields: upload.fields || [],
  previewRows: upload.previewRows || [],
  previewRaw: upload.previewRaw || [],
  warnings: upload.warnings || [],
  suggestedPeriod: upload.suggestedPeriod || null,
  rowCount: upload.rowCount ?? upload.previewRows?.length ?? 0,
});

export const toUploadListDto = (upload) => ({
  id: upload.id,
  kind: upload.kind,
  originalName: upload.originalName,
  size: upload.size,
  status: upload.status,
  selectedSheet: upload.selectedSheet,
  headerRow: upload.headerRow,
  period: upload.period || null,
  companyName: upload.companyName || null,
  report: upload.report,
  error: upload.error,
  createdAt: upload.createdAt,
  updatedAt: upload.updatedAt,
});

export const toUploadDetailDto = (upload) => ({
  ...toUploadListDto(upload),
  mimetype: upload.mimetype,
  sheetNames: upload.sheetNames || [],
  parse: toParseDto(upload),
});

export const toUploadList = (uploads) => uploads.map(toUploadListDto);
