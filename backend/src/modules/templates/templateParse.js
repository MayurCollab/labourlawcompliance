import PizZip from 'pizzip';
import * as XLSX from 'xlsx';

import {
  emptyMapping,
  SCALAR_KEYS,
  SLAB_KEYS,
} from './canonicalFields.js';
import { autoMapFromMarks } from './autoMapMarks.js';
import { extractDocxMarks } from './docxMarks.js';
import { extractExcelMarks } from './excelMarks.js';
import { extractPdfMarks } from './pdfMarks.js';

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const CELL_RE = /^([A-Za-z0-9_ ]+!)?[A-Za-z]{1,3}\d{1,7}$/;

const EXCEL_EXTS = new Set(['.xlsx', '.xlsm', '.xls']);

export const templateKindFromName = (originalName = '') => {
  const ext = String(originalName).toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  if (EXCEL_EXTS.has(ext)) return 'excel';
  if (ext === '.docx') return 'docx';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.html' || ext === '.htm') return 'html';
  return null;
};

export const isCellBind = (value) => CELL_RE.test(String(value || '').trim());

export const slugFromFilename = (originalName = '') => {
  const base = String(originalName)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '');
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'template';
};

const unique = (values) => [...new Set(values.filter(Boolean))];

export const placeholderTokens = (text) => {
  const tokens = [];
  const raw = String(text ?? '');
  PLACEHOLDER_RE.lastIndex = 0;
  let match = PLACEHOLDER_RE.exec(raw);
  while (match) {
    tokens.push(match[1]);
    match = PLACEHOLDER_RE.exec(raw);
  }
  return tokens;
};

const parseExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const placeholders = [];
  const cells = [];
  const seen = new Set();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    for (const address of Object.keys(sheet)) {
      if (address.startsWith('!')) continue;
      const cell = sheet[address];
      const text = String(cell?.w ?? cell?.v ?? '');
      const tokens = placeholderTokens(text);
      if (!tokens.length) continue;
      const bind =
        workbook.SheetNames.length > 1 ? `${sheetName}!${address}` : address;
      cells.push({ sheet: sheetName, address, bind, value: text, tokens });
      seen.add(bind);
      placeholders.push(...tokens);
    }
  }

  const marks = extractExcelMarks(buffer);
  for (const cell of marks.cells || []) {
    if (seen.has(cell.bind)) continue;
    cells.push(cell);
    seen.add(cell.bind);
  }

  return {
    kind: 'excel',
    sheetNames: workbook.SheetNames,
    placeholders: unique(placeholders),
    cells,
    warnings: marks.warnings || [],
  };
};

const parseDocx = (buffer) => {
  const zip = new PizZip(buffer);
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) {
    return {
      kind: 'docx',
      sheetNames: [],
      placeholders: [],
      cells: [],
      warnings: ['This Word file has no document.xml — it may not be a valid .docx.'],
    };
  }

  const xml = documentXml.asText();
  const placeholders = unique(placeholderTokens(xml));
  const marks = extractDocxMarks(xml);
  return {
    kind: 'docx',
    sheetNames: [],
    placeholders,
    cells: marks.cells,
    warnings: marks.warnings,
  };
};

const tokenKey = (token) =>
  String(token || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * slab_12000_employeeCount or slab_0_2999_taxAmount
 */
export const parseSlabToken = (token) => {
  const raw = String(token || '').trim();
  const match = raw.match(
    /^slab[_-]?(\d+)(?:[_-](\d+|above|andabove))?[_-]([A-Za-z]+)$/i,
  );
  if (!match) return null;
  const bindKey = match[3];
  const normalised =
    bindKey.charAt(0).toLowerCase() + bindKey.slice(1);
  if (!SLAB_KEYS.includes(normalised)) return null;
  const from = Number(match[1]);
  const toToken = match[2];
  const salaryTo =
    !toToken || /above/i.test(toToken) ? null : Number(toToken);
  return { salaryFrom: from, salaryTo, bindKey: normalised };
};

export const autoMapFromPlaceholders = (placeholders, mapping) => {
  const scalars = { ...mapping.scalars };
  const slabs = mapping.slabs.map((row) => ({
    ...row,
    binds: { ...row.binds },
  }));

  const scalarByToken = new Map(
    SCALAR_KEYS.map((key) => [tokenKey(key), key]),
  );

  for (const token of placeholders) {
    const key = scalarByToken.get(tokenKey(token));
    if (key && !scalars[key]) {
      scalars[key] = `{{${token}}}`;
      continue;
    }

    const slabToken = parseSlabToken(token);
    if (!slabToken) continue;
    const row = slabs.find(
      (item) =>
        item.salaryFrom === slabToken.salaryFrom &&
        (item.salaryTo ?? null) === (slabToken.salaryTo ?? null),
    );
    if (row && !row.binds[slabToken.bindKey]) {
      row.binds[slabToken.bindKey] = `{{${token}}}`;
    }
  }

  return { scalars, slabs };
};

const parseHtml = (buffer) => {
  const source = Buffer.isBuffer(buffer)
    ? buffer.toString('utf8')
    : String(buffer ?? '');
  const placeholders = unique(placeholderTokens(source));
  return {
    kind: 'html',
    sheetNames: [],
    placeholders,
    cells: [],
    warnings: placeholders.length
      ? []
      : ['This HTML file has no {{placeholders}} — check the template source.'],
  };
};

const finishParse = (parsed, slabs) => {
  let mapping = autoMapFromPlaceholders(
    parsed.placeholders || [],
    emptyMapping(slabs),
  );
  if (parsed.cells?.length) {
    const markCells = parsed.cells.filter(
      (cell) =>
        !(cell.tokens && cell.tokens.length) &&
        !/\{\{/.test(String(cell.value || '')),
    );
    if (markCells.length) {
      mapping = autoMapFromMarks(markCells, mapping);
    }
  }

  return {
    kind: parsed.kind,
    sheetNames: parsed.sheetNames || [],
    placeholders: parsed.placeholders || [],
    cells: parsed.cells || [],
    warnings: parsed.warnings || [],
    mapping,
  };
};

/**
 * Read {{placeholders}}, Excel yellow/sample cells, Word highlights, or PDF boxes.
 */
export const parseTemplateFile = (buffer, originalName = '', slabs = []) => {
  const kind = templateKindFromName(originalName);
  if (!kind) {
    throw new Error(
      'Template must be Excel (.xlsx, .xlsm, .xls), Word (.docx), HTML (.html), or PDF (.pdf)',
    );
  }
  if (kind === 'pdf') {
    throw new Error('PDF templates are parsed asynchronously');
  }

  const parsed =
    kind === 'html'
      ? parseHtml(buffer)
      : kind === 'docx'
        ? parseDocx(buffer)
        : parseExcel(buffer);
  return finishParse(parsed, slabs);
};

export const parseAnyTemplate = async (buffer, originalName = '', slabs = []) => {
  const kind = templateKindFromName(originalName);
  if (kind === 'pdf') {
    const parsed = await extractPdfMarks(buffer);
    return finishParse({ kind: 'pdf', ...parsed, placeholders: [] }, slabs);
  }
  return parseTemplateFile(buffer, originalName, slabs);
};
