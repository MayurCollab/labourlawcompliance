export type FilingClientRef = {
  id: string;
  clientCode: string;
  companyName: string;
  location: { id: string; name: string | null } | null;
  phyCode: string | null;
  includeEmployeesOnForm5?: boolean;
  address?: string | null;
  signatoryName?: string | null;
  contactNumber?: string | null;
};

export type FilingSlabRow = {
  label: string;
  salaryFrom: number;
  salaryTo: number | null;
  rate: number;
  employeeCount: number;
  exemptCount: number;
  taxableCount: number;
  taxAmount: number;
};

export type FilingVariance = {
  employeeNo: string;
  ptGross: number | null;
  sheetPTax: number | null;
  computedRate: number | null;
};

export type FilingComputation = {
  slabs: FilingSlabRow[];
  totalA: number;
  totalB: number;
  interest: number;
  totalPayable: number;
  employeeCount: number;
  totalEmployeeCount?: number;
  taxableEmployeeCount?: number;
  exemptEmployeeCount?: number;
  unmatchedExcluded: number;
  unslottedCount: number;
  varianceCount: number;
  variances: FilingVariance[];
  computedAt: string;
};

export type GenerateOverrides = {
  employerAddress: string | null;
  signatoryName: string | null;
  filingDate: string | null;
  additionalTaxPayable: number | null;
};

export type EmployeePreviewRow = {
  srNo: number;
  employeeNo: string;
  employeeName: string;
  locationName: string;
  ptGross: number | null;
  pTax: number | null;
  phyCode: string;
};

export type EmployeePreview = {
  totalEmployeeCount: number;
  taxableEmployeeCount: number;
  exemptEmployeeCount: number;
  employees: EmployeePreviewRow[];
};

export type UpdateFilingOverridesPayload = {
  employerAddress?: string | null;
  signatoryName?: string | null;
  filingDate?: string | null;
  additionalTaxPayable?: number | null;
};

export type Filing = {
  id: string;
  client: FilingClientRef | null;
  clientCode: string;
  period: string;
  periodLabel: string | null;
  status: string | null;
  taskNo: string | null;
  ptAmount: number | null;
  chequeNo: string | null;
  sentDate: string | null;
  challanNo: string | null;
  challanDate: string | null;
  receivedInBank: string | null;
  lessPaymentReceived: string | null;
  link: string | null;
  mailStatus: string | null;
  originalChallanStatus: string | null;
  generateStatus: 'pending' | 'generated' | 'failed';
  generateOverrides: GenerateOverrides | null;
  computation: FilingComputation | null;
  employeePreview?: EmployeePreview | null;
  generatedFile: GeneratedForm5File | null;
  generatedHistory: GeneratedForm5File[];
  hasTemplate: boolean;
  templateSource: 'client' | 'location' | 'global' | null;
  templateName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedForm5File = {
  version: number;
  filename: string;
  mimetype: string;
  size: number;
  /** S3 object URL when stored in the bucket (private — prefer /download). */
  url?: string | null;
  templateName: string | null;
  templateCode: string | null;
  source: 'client' | 'location' | 'global' | null;
  generatedAt: string;
};

export type ListFilingsParams = {
  page?: number;
  limit?: number;
  search?: string;
  period?: string;
  locationId?: string;
  locationIds?: string[];
  clientId?: string;
  clientIds?: string[];
  generateStatus?: 'pending' | 'generated' | 'failed';
  sortBy?: 'period' | 'clientCode' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListFilingsResult = {
  filings: Filing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type BulkGeneratePayload = {
  ids?: string[];
  period?: string;
  locationId?: string;
  locationIds?: string[];
  clientId?: string;
  clientIds?: string[];
  generateStatus?: 'pending' | 'generated' | 'failed';
  search?: string;
};

export type SendFilingWhatsAppPayload = {
  phone?: string;
  savePhone?: boolean;
};

export type SendFilingWhatsAppResult = {
  filing: Filing;
  phone: string;
  msg91: unknown;
};

export type BulkGenerateRow = {
  id: string;
  clientCode: string | null;
  outcome: 'generated' | 'skipped' | 'failed';
  reason: string | null;
  filename?: string | null;
};

export type BulkGenerateReport = {
  generated: number;
  skipped: number;
  failed: number;
  results: BulkGenerateRow[];
};

export type BulkGenerateProgressEvent = {
  phase: 'generate';
  processed: number;
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  current: { id: string; clientCode: string | null } | null;
  lastResult: BulkGenerateRow | null;
};
