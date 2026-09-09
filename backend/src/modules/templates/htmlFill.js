import Handlebars from 'handlebars';

import { GUJARAT_DEFAULT_SLABS } from '../ptSlabs/ptSlabs.constants.js';
import {
  readBundledMehsanaHeaderDataUri,
  readBundledPartials,
  readBundledSignatureDataUri,
} from '../../templates/form5/readBundledTemplate.js';

const NIL_SENTINEL = 'NIL';

/**
 * Format numbers for Form 5 HTML output. Zero/null/undefined → "NIL" when
 * nilIfZero is true (totals B, interest); otherwise empty string or 0.
 */
export const formatForm5Value = (value, { nilIfZero = false } = {}) => {
  if (value === null || value === undefined || value === '') {
    return nilIfZero ? NIL_SENTINEL : '';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return nilIfZero ? NIL_SENTINEL : '';
    if (value === 0 && nilIfZero) return NIL_SENTINEL;
    return value;
  }
  if (value === NIL_SENTINEL) return NIL_SENTINEL;
  return String(value);
};

/** Blank when zero — matches official Form 5 empty-cell style. */
const blankIfZero = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return n;
};

const sameSlab = (left, right) => {
  if (!left || !right) return false;
  return (
    Number(left.salaryFrom) === Number(right.salaryFrom) &&
    (left.salaryTo ?? null) === (right.salaryTo ?? null)
  );
};

/**
 * Resolve the five Gujarat Form 5 rows by salary band (not array index),
 * so partial computation results still fill the official grid.
 */
export const resolveOfficialSlabRows = (slabs = []) => {
  const list = Array.isArray(slabs) ? slabs : [];
  return GUJARAT_DEFAULT_SLABS.map((shape) => {
    const found =
      list.find((row) => sameSlab(row, shape)) ||
      list.find(
        (row) =>
          Number(row.salaryFrom) === Number(shape.salaryFrom) &&
          (shape.salaryTo == null
            ? row.salaryTo == null || row.salaryTo === undefined
            : Number(row.salaryTo) === Number(shape.salaryTo)),
      );
    return {
      label: found?.label || shape.label,
      salaryFrom: shape.salaryFrom,
      salaryTo: shape.salaryTo ?? null,
      rate: found?.rate ?? shape.rate,
      employeeCount: Number(found?.employeeCount) || 0,
      exemptCount: Number(found?.exemptCount) || 0,
      taxableCount: Number(found?.taxableCount) || 0,
      taxAmount: Number(found?.taxAmount) || 0,
    };
  });
};

/**
 * Indexed slab fields used by the PDF-accurate English Form 5 HTML.
 * Example: slab5_no_emp, slab1_rate.
 */
export const buildOfficialSlabPlaceholders = (slabs = []) => {
  const rows = resolveOfficialSlabRows(slabs);
  const out = {};
  rows.forEach((row, index) => {
    const n = index + 1;
    out[`slab${n}_no_emp`] = blankIfZero(row.employeeCount);
    out[`slab${n}_no_tax_exempt`] = blankIfZero(row.exemptCount);
    out[`slab${n}_taxable_emp`] = blankIfZero(row.taxableCount);
    out[`slab${n}_rate`] = row.rate;
    out[`slab${n}_amount`] = blankIfZero(row.taxAmount);
  });
  return out;
};

const buildArrearsPlaceholders = () => ({
  arrears_no_emp: '',
  arrears_rate_payable: '',
  arrears_rate_paid: '',
  arrears_rate_diff: '',
  arrears_months: '',
  arrears_additional_tax: '',
});

/**
 * Flatten canonical Form 5 values for Handlebars templates.
 * Scalars become top-level keys; slabs, employees, and meta stay nested.
 * Also exposes official English Form 5 indexed slab fields.
 */
export const flattenValuesForHandlebars = (values = {}) => {
  const scalars = values.scalars || {};
  const slabs = Array.isArray(values.slabs) ? values.slabs : [];
  const employees = Array.isArray(values.employees) ? values.employees : [];
  const meta = values.meta && typeof values.meta === 'object' ? values.meta : {};

  const totalARaw = scalars.totalA;
  const additionalTaxRaw =
    scalars.additionalTaxPayable ??
    (scalars.totalB === NIL_SENTINEL || scalars.totalB === 'NIL'
      ? 0
      : scalars.totalB);
  const totalANum = Number(totalARaw);
  const additionalTaxNum = Number(additionalTaxRaw);
  const totalTaxNum =
    (Number.isFinite(totalANum) ? totalANum : 0) +
    (Number.isFinite(additionalTaxNum) ? additionalTaxNum : 0);
  const totalPayableRaw = scalars.totalPayable ?? totalTaxNum;
  const totalPayableNum = Number(totalPayableRaw);
  const interestDisplay = formatForm5Value(scalars.interest, { nilIfZero: true });
  const totalBDisplay = formatForm5Value(scalars.totalB, { nilIfZero: true });

  return {
    ...scalars,
    slabs,
    employees,
    meta,
    // Official English Form 5 blanks zero cells; district layouts still
    // receive the raw slabs array and can format via helpers.
    totalA: blankIfZero(totalARaw),
    totalB: totalBDisplay,
    interest: interestDisplay,
    totalTax: blankIfZero(totalTaxNum),
    totalPayable: blankIfZero(totalPayableNum),
    includeEmployees: scalars.includeEmployees !== false,
    additionalTaxPayable: formatForm5Value(
      scalars.additionalTaxPayable ?? scalars.totalB,
      { nilIfZero: true },
    ),
    ...buildOfficialSlabPlaceholders(slabs),
    ...buildArrearsPlaceholders(),
  };
};

let helpersRegistered = false;

/** Always re-read disk so stamp/partial edits apply without a process restart. */
const registerPartials = async () => {
  const partials = await readBundledPartials();
  for (const [name, source] of Object.entries(partials)) {
    Handlebars.registerPartial(name, source);
  }
};

const registerHelpers = () => {
  if (helpersRegistered) return;
  helpersRegistered = true;

  Handlebars.registerHelper('nilIfZero', (value) =>
    formatForm5Value(value, { nilIfZero: true }),
  );

  Handlebars.registerHelper('currency', (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return formatForm5Value(value);
    return n.toLocaleString('en-IN');
  });

  Handlebars.registerHelper('salaryRange', (row) => {
    if (!row || typeof row !== 'object') return '';
    const from = row.salaryFrom ?? row.from ?? '';
    const to = row.salaryTo ?? row.to;
    if (to === null || to === undefined || to === '') {
      return `${from} and above`;
    }
    return `${from} – ${to}`;
  });
};

/**
 * Fill an HTML Form 5 template with canonical values using Handlebars.
 */
export const fillHtmlTemplate = async (templateSource, values) => {
  registerHelpers();
  await registerPartials();
  const [signatureImageSrc, mehsanaHeaderImageSrc] = await Promise.all([
    readBundledSignatureDataUri(),
    readBundledMehsanaHeaderDataUri(),
  ]);
  const compile = Handlebars.compile(String(templateSource ?? ''), {
    strict: false,
    noEscape: false,
  });
  return compile({
    ...flattenValuesForHandlebars(values),
    signatureImageSrc,
    mehsanaHeaderImageSrc,
  });
};

/**
 * Fill HTML from a buffer (UTF-8 template file).
 */
export const fillHtmlBuffer = async (buffer, values) => {
  const source = Buffer.isBuffer(buffer)
    ? buffer.toString('utf8')
    : String(buffer ?? '');
  const html = await fillHtmlTemplate(source, values);
  return Buffer.from(html, 'utf8');
};

/** No-op kept for older tests that still import this helper. */
export const resetHtmlFillPartialsForTests = () => {};
