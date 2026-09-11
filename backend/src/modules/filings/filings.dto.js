import { toLocationRefDto } from '../locations/locations.dto.js';

const toSlabRowDto = (row) => ({
  label: row.label,
  salaryFrom: row.salaryFrom,
  salaryTo: row.salaryTo ?? null,
  rate: row.rate,
  employeeCount: row.employeeCount,
  exemptCount: row.exemptCount,
  taxableCount: row.taxableCount,
  taxAmount: row.taxAmount,
});

const toVarianceDto = (row) => ({
  employeeNo: row.employeeNo,
  ptGross: row.ptGross,
  sheetPTax: row.sheetPTax,
  computedRate: row.computedRate,
});

export const toComputationDto = (computation) => {
  if (!computation) return null;
  return {
    slabs: (computation.slabs || []).map(toSlabRowDto),
    totalA: computation.totalA,
    totalB: computation.totalB,
    interest: computation.interest,
    totalPayable: computation.totalPayable,
    employeeCount: computation.employeeCount,
    totalEmployeeCount: computation.totalEmployeeCount ?? computation.employeeCount,
    taxableEmployeeCount: computation.taxableEmployeeCount ?? 0,
    exemptEmployeeCount: computation.exemptEmployeeCount ?? 0,
    unmatchedExcluded: computation.unmatchedExcluded,
    unslottedCount: computation.unslottedCount,
    varianceCount: computation.varianceCount,
    variances: (computation.variances || []).map(toVarianceDto),
    computedAt: computation.computedAt,
  };
};

const toGeneratedFileDto = (file) => {
  if (!file || !file.filename) return null;
  const storedPath = file.storedPath || '';
  const url = /^https?:\/\//i.test(storedPath) ? storedPath : null;
  return {
    version: file.version,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    /** S3 object URL when storage driver uses the bucket (private — use /download). */
    url,
    templateName: file.templateName || null,
    templateCode: file.templateCode || null,
    source: file.source || null,
    generatedAt: file.generatedAt,
  };
};

const refName = (value) =>
  value && typeof value === 'object' ? value.name || null : null;

const refId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return value.id || (value._id ? String(value._id) : null);
  }
  return String(value);
};

export const toTemplateHint = (filing, globalDefault) => {
  const client = filing.client;
  if (refId(client?.template)) {
    return {
      hasTemplate: true,
      templateSource: 'client',
      templateName: refName(client.template),
    };
  }
  if (refId(client?.location?.defaultTemplate)) {
    return {
      hasTemplate: true,
      templateSource: 'location',
      templateName: refName(client.location.defaultTemplate),
    };
  }
  if (globalDefault) {
    return {
      hasTemplate: true,
      templateSource: 'global',
      templateName: globalDefault.name || null,
    };
  }
  return {
    hasTemplate: false,
    templateSource: null,
    templateName: null,
  };
};

const toGenerateOverridesDto = (overrides) => {
  if (!overrides) return null;
  return {
    employerAddress: overrides.employerAddress ?? null,
    signatoryName: overrides.signatoryName ?? null,
    filingDate: overrides.filingDate ?? null,
    additionalTaxPayable: overrides.additionalTaxPayable ?? null,
  };
};

export const toFilingDto = (filing, extras = {}) => ({
  id: filing.id,
  client: filing.client
    ? {
        id: filing.client.id,
        clientCode: filing.client.clientCode,
        companyName: filing.client.companyName,
        location: toLocationRefDto(filing.client.location),
        phyCode: filing.client.phyCode ?? null,
        includeEmployeesOnForm5: filing.client.includeEmployeesOnForm5 !== false,
        address: filing.client.address ?? null,
        signatoryName: filing.client.signatoryName ?? null,
        contactNumber: filing.client.contactNumber ?? null,
        recipientName: filing.client.recipientName ?? null,
      }
    : null,
  clientCode: filing.clientCode,
  period: filing.period,
  periodLabel: filing.periodLabel,
  status: filing.status,
  taskNo: filing.taskNo,
  ptAmount: filing.ptAmount,
  salaryPtTotal: extras.salaryPtTotal ?? null,
  salaryEmployeeCount: extras.salaryEmployeeCount ?? 0,
  ptMismatch: Boolean(extras.ptMismatch),
  ptMismatchDelta: extras.ptMismatchDelta ?? null,
  chequeNo: filing.chequeNo,
  sentDate: filing.sentDate,
  challanNo: filing.challanNo,
  challanDate: filing.challanDate,
  receivedInBank: filing.receivedInBank,
  lessPaymentReceived: filing.lessPaymentReceived,
  link: filing.link,
  mailStatus: filing.mailStatus,
  originalChallanStatus: filing.originalChallanStatus,
  generateStatus: filing.generateStatus,
  generateOverrides: toGenerateOverridesDto(filing.generateOverrides),
  computation: toComputationDto(filing.computation),
  employeePreview: extras.employeePreview ?? null,
  generatedFile: toGeneratedFileDto(filing.generatedFile),
  generatedHistory: (filing.generatedHistory || []).map(toGeneratedFileDto),
  ...toTemplateHint(filing, extras.globalDefault),
  createdAt: filing.createdAt,
  updatedAt: filing.updatedAt,
});

export const toFilingListDto = (filings, extras = {}) =>
  filings.map((filing) => ({
    ...toFilingDto(filing, extras),
    generatedHistory: [],
  }));
