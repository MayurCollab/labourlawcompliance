export type UploadKind = 'master' | 'salary' | 'clientMaster';

export type UploadStatus = 'uploaded' | 'previewed' | 'imported' | 'failed';

export type UploadHeader = {
  index: number;
  label: string;
};

export type UploadField = {
  key: string;
  label: string;
  required: boolean;
  group: 'client' | 'filing' | 'employee';
};

export type UploadMapping = Record<string, number | null>;

export type UploadPreviewRow = {
  excelRow: number;
  cells: Record<string, string>;
  unmatched?: boolean;
  unmatchedReason?: string | null;
};

export type UploadPreviewRaw = {
  excelRow: number;
  values: string[];
};

export type ImportSkippedRow = {
  row: number;
  reason: string;
};

export type ImportUnmatchedRow = {
  row: number;
  employeeNo?: string;
  phyCode?: string;
  clientCode?: string;
  reason: string;
};

export type ImportReport = {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: ImportSkippedRow[];
  unmatched: ImportUnmatchedRow[];
  rematchedEmployees?: number;
  filings?: {
    inserted: number;
    updated: number;
    unchanged: number;
  };
};

export type UploadParse = {
  sheetNames: string[];
  selectedSheet: string | null;
  headerRow: number | null;
  headers: UploadHeader[];
  mapping: UploadMapping;
  fields: UploadField[];
  previewRows: UploadPreviewRow[];
  previewRaw: UploadPreviewRaw[];
  warnings: string[];
  suggestedPeriod: string | null;
  rowCount: number;
};

export type UploadListItem = {
  id: string;
  kind: UploadKind;
  originalName: string;
  size: number;
  status: UploadStatus;
  selectedSheet: string | null;
  headerRow: number | null;
  period: string | null;
  companyName: string | null;
  report: ImportReport | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UploadDetail = UploadListItem & {
  mimetype: string;
  sheetNames: string[];
  parse: UploadParse;
};

export type ListUploadsParams = {
  page?: number;
  limit?: number;
  kind?: UploadKind;
  sortBy?: 'createdAt' | 'originalName' | 'status';
  sortOrder?: 'asc' | 'desc';
};

export type ListUploadsResult = {
  uploads: UploadListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ImportUploadPayload = {
  sheetName?: string;
  mapping: UploadMapping;
  period?: string;
  companyName?: string | null;
};

export type ImportProgressPhase = 'import' | 'rematch';

export type ImportProgressEvent = {
  phase: ImportProgressPhase;
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  unmatched: number;
  filings?: {
    inserted: number;
    updated: number;
    unchanged: number;
  };
};

export type ImportUploadResult = {
  upload: UploadDetail;
  report: ImportReport;
};

export type ListUploadRowsPayload = {
  sheetName?: string;
  mapping?: UploadMapping;
  page?: number;
  limit?: number;
  companyName?: string | null;
};

export type UploadRowsResult = {
  kind: UploadKind;
  selectedSheet: string | null;
  mapping: UploadMapping;
  fields: UploadField[];
  rows: UploadPreviewRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
