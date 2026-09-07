/**
 * Canonical Form 5 values for the generator. Templates only consume this
 * map via mapping JSON — no district layout lives here.
 */

const ACT_NAME =
  'Gujarat State Tax on Professions, Trades, Callings and Employments Act';

const IST = 'Asia/Kolkata';

const pad2 = (value) => String(value).padStart(2, '0');

export const formatDateIn = (date, timeZone = IST) => {
  if (!date) return '';
  const dt = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dt.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(dt);
  const by = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${by.day}/${by.month}/${by.year}`;
};

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const periodBounds = (period) => {
  const match = String(period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return { from: '', to: '', label: '' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthName = monthNames[month - 1] || match[2];
  return {
    from: `01/${pad2(month)}/${year}`,
    to: `${pad2(lastDay)}/${pad2(month)}/${year}`,
    label: `${monthName}-${String(year).slice(-2)}`,
  };
};

const nilIfZero = (value) => {
  if (value === null || value === undefined || Number(value) === 0) return 'NIL';
  return value;
};

const asNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const resolveAdditionalTax = (overrides, computation) => {
  if (overrides?.additionalTaxPayable != null) {
    return asNumber(overrides.additionalTaxPayable) ?? 0;
  }
  return asNumber(computation?.totalB) ?? 0;
};

const resolveInterestAmount = (computation) => {
  const raw = computation?.interest;
  if (raw === 'NIL' || raw === null || raw === undefined || raw === '') return 0;
  return asNumber(raw) ?? 0;
};

/**
 * When salary has not been computed, build Form 5 totals from the
 * MasterSheet P.Tax Amount (ptAmount). Prefer the open-ended 12,000+
 * band when amount ÷ rate is a whole employee count.
 */
export const buildComputationFromMaster = (filing, slabs = []) => {
  const totalA = Number(filing?.ptAmount);
  const amount = Number.isFinite(totalA) && totalA > 0 ? totalA : 0;
  const list = Array.isArray(slabs) ? slabs : [];
  const top =
    list.find((row) => row.salaryTo == null || row.salaryTo === undefined) ||
    list.find((row) => Number(row.salaryFrom) === 12000) ||
    list[list.length - 1] ||
    null;
  const rate = Number(top?.rate) || 200;
  const countable =
    rate > 0 && amount > 0 && amount % rate === 0 ? amount / rate : 0;

  return {
    slabs: list.map((slab) => {
      const isTop =
        top &&
        slab.salaryFrom === top.salaryFrom &&
        (slab.salaryTo ?? null) === (top.salaryTo ?? null);
      const employeeCount = isTop ? countable : 0;
      return {
        label: slab.label || '',
        salaryFrom: slab.salaryFrom,
        salaryTo: slab.salaryTo ?? null,
        rate: slab.rate,
        employeeCount,
        exemptCount: 0,
        taxableCount: employeeCount,
        taxAmount: isTop ? amount : 0,
      };
    }),
    totalA: amount,
    totalB: 0,
    interest: 0,
    totalPayable: amount,
    employeeCount: countable,
    unmatchedExcluded: 0,
    unslottedCount: 0,
    varianceCount: 0,
    variances: [],
    computedAt: null,
    source: 'master',
  };
};

export const form5Filename = ({
  clientCode,
  locationName,
  period,
  ext = '.pdf',
}) => {
  const code = String(clientCode || 'CLIENT')
    .replace(/[^\w]+/g, '')
    .slice(0, 32) || 'CLIENT';
  const loc =
    String(locationName || 'NA')
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'NA';
  const safeExt = String(ext || '.xlsx').startsWith('.')
    ? String(ext)
    : `.${ext}`;
  return `${code}_${loc}_${period}_Form5${safeExt}`;
};

export const buildForm5Values = ({
  filing,
  client,
  settings,
  generatedAt = new Date(),
  employees = [],
  includeEmployees = true,
  templateCode = null,
}) => {
  const computation = filing?.computation || {};
  const overrides = filing?.generateOverrides || {};
  const bounds = periodBounds(filing?.period);
  const employerName =
    client?.companyName || client?.draftName || filing?.clientCode || '';
  const companyName = client?.companyName || '';
  const clientCode = filing?.clientCode || client?.clientCode || '';
  const signatoryName =
    (overrides.signatoryName && String(overrides.signatoryName).trim()) ||
    (client?.signatoryName && String(client.signatoryName).trim()) ||
    (settings?.signatoryName && String(settings.signatoryName).trim()) ||
    '';
  const employerAddress =
    (overrides.employerAddress && String(overrides.employerAddress).trim()) ||
    (client?.address && String(client.address).trim()) ||
    '';
  const place = client?.location?.name || '';
  const filingDate = overrides.filingDate
    ? formatDateIn(overrides.filingDate)
    : formatDateIn(generatedAt);
  const paymentDate = formatDateIn(filing?.challanDate);
  const amountPaid =
    filing?.ptAmount == null ? computation.totalPayable ?? 0 : filing.ptAmount;

  const totalA =
    computation.totalA != null && computation.totalA !== undefined
      ? computation.totalA
      : amountPaid || 0;
  const additionalTaxPayable = resolveAdditionalTax(overrides, computation);
  const interestAmount = resolveInterestAmount(computation);
  const totalPayable = totalA + additionalTaxPayable + interestAmount;

  const listedEmployees = Array.isArray(employees) ? employees : [];
  const employeesTotalPtGross = listedEmployees.reduce(
    (sum, row) => sum + (Number(row.ptGross) || 0),
    0,
  );
  const employeesTotalPTax = listedEmployees.reduce(
    (sum, row) => sum + (Number(row.pTax) || 0),
    0,
  );
  const totalEmployeeCount =
    computation.totalEmployeeCount ??
    computation.employeeCount ??
    listedEmployees.length;
  const taxableEmployeeCount =
    computation.taxableEmployeeCount ??
    listedEmployees.filter((row) => Number(row.pTax) > 0).length;
  const exemptEmployeeCount =
    computation.exemptEmployeeCount ??
    Math.max(0, totalEmployeeCount - taxableEmployeeCount);

  return {
    scalars: {
      formTitle: 'Form 5',
      actName: ACT_NAME,
      periodMonthLabel: filing?.periodLabel || bounds.label,
      professionalTaxMonthLabel: bounds.label || filing?.periodLabel || '',
      periodFrom: bounds.from,
      periodTo: bounds.to,
      employerName,
      companyName,
      clientCode,
      employerAddress,
      rcNumber: client?.rcNumber || '',
      signatoryName,
      place,
      filingDate,
      receiptNumber: filing?.challanNo || '',
      paymentDate,
      amountPaid: amountPaid ?? totalPayable,
      totalEmployeeCount,
      taxableEmployeeCount,
      exemptEmployeeCount,
      includeEmployees: includeEmployees !== false,
      employeesTotalPtGross,
      employeesTotalPTax,
      totalA,
      additionalTaxPayable,
      totalB: nilIfZero(additionalTaxPayable),
      interest: nilIfZero(computation.interest ?? interestAmount),
      totalPayable,
      totalPaidWithInterest: totalPayable,
    },
    slabs: (computation.slabs || []).map((row) => ({
      label: row.label,
      salaryFrom: row.salaryFrom,
      salaryTo: row.salaryTo ?? null,
      rate: row.rate,
      employeeCount: row.employeeCount,
      exemptCount: row.exemptCount,
      taxableCount: row.taxableCount,
      taxAmount: row.taxAmount,
    })),
    employees: listedEmployees,
    meta: {
      templateCode: templateCode || null,
      clientCode: filing?.clientCode || client?.clientCode || '',
      period: filing?.period || '',
      unmatchedExcluded: computation.unmatchedExcluded ?? 0,
      varianceCount: computation.varianceCount ?? 0,
      generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : generatedAt,
    },
  };
};
