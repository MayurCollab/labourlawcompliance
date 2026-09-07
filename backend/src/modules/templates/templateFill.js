import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PizZip from 'pizzip';
import * as XLSX from 'xlsx';

import { fillHtmlBuffer } from './htmlFill.js';
import { SLAB_KEYS } from './canonicalFields.js';
import { replaceDocxRunGroups } from './docxMarks.js';
import { fillExcelPreservingLayout } from './excelFill.js';
import { substituteForm5CellText } from './excelMarks.js';
import { parsePdfBind } from './pdfMarks.js';
import {
  isCellBind,
  placeholderTokens,
  templateKindFromName,
} from './templateParse.js';
const PLACEHOLDER_ONLY = /^\{\{\s*[A-Za-z0-9_.-]+\s*\}\}$/;
const NUMERIC_VALUE = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const tokenFromBind = (bind) => {
  const tokens = placeholderTokens(bind);
  if (tokens.length) return tokens[0];
  const stripped = String(bind || '')
    .trim()
    .replace(/^\{\{|\}\}$/g, '')
    .trim();
  return stripped || null;
};

const parseCellBind = (bind) => {
  const raw = String(bind || '').trim();
  const bang = raw.lastIndexOf('!');
  if (bang === -1) return { sheet: null, address: raw.toUpperCase() };
  return {
    sheet: raw.slice(0, bang).trim(),
    address: raw.slice(bang + 1).trim().toUpperCase(),
  };
};

const findSheet = (workbook, sheetName) => {
  if (sheetName && workbook.Sheets[sheetName]) {
    return workbook.Sheets[sheetName];
  }
  if (sheetName) {
    const match = workbook.SheetNames.find(
      (name) => name.toLowerCase() === sheetName.toLowerCase(),
    );
    if (match) return workbook.Sheets[match];
  }
  return workbook.Sheets[workbook.SheetNames[0]];
};

const writeCell = (workbook, bind, value, { fieldKey = null, values = null } = {}) => {
  const { sheet: sheetName, address } = parseCellBind(bind);
  const sheet = findSheet(workbook, sheetName);
  if (!sheet || !address) return;
  const existing = sheet[address];
  const existingText = String(existing?.w ?? existing?.v ?? '');
  let next = value ?? '';
  if (fieldKey && existingText) {
    next = substituteForm5CellText(existingText, fieldKey, value, values);
  }
  XLSX.utils.sheet_add_aoa(sheet, [[next]], { origin: address });
};

const replaceTokenInCell = (cell, token, value) => {
  const text = String(cell?.w ?? cell?.v ?? '');
  const re = new RegExp(`\\{\\{\\s*${escapeRegex(token)}\\s*\\}\\}`, 'g');
  if (!re.test(text)) return false;
  re.lastIndex = 0;
  const next = text.replace(re, value == null ? '' : String(value));
  if (PLACEHOLDER_ONLY.test(text.trim()) && NUMERIC_VALUE(value)) {
    cell.t = 'n';
    cell.v = value;
    delete cell.w;
    delete cell.z;
    return true;
  }
  cell.t = 's';
  cell.v = next;
  delete cell.w;
  return true;
};

const replaceTokenInWorkbook = (workbook, token, value) => {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    for (const address of Object.keys(sheet)) {
      if (address.startsWith('!')) continue;
      replaceTokenInCell(sheet[address], token, value);
    }
  }
};

const applyBind = (workbook, bind, value, options = {}) => {
  if (!bind) return;
  if (isCellBind(bind)) {
    writeCell(workbook, bind, value ?? '', options);
    return;
  }
  const token = tokenFromBind(bind);
  if (!token) return;
  replaceTokenInWorkbook(workbook, token, value);
};

const matchSlab = (computedSlabs, mapped) =>
  (computedSlabs || []).find(
    (row) =>
      row.salaryFrom === mapped.salaryFrom &&
      (row.salaryTo ?? null) === (mapped.salaryTo ?? null) &&
      row.rate === mapped.rate,
  ) ||
  (computedSlabs || []).find(
    (row) =>
      row.salaryFrom === mapped.salaryFrom &&
      (row.salaryTo ?? null) === (mapped.salaryTo ?? null),
  );

const slabFieldValue = (row, key) => {
  if (!row) {
    if (key === 'salaryTo') return 'and above';
    return 0;
  }
  if (key === 'salaryTo' && (row.salaryTo === null || row.salaryTo === undefined)) {
    return 'and above';
  }
  if (key === 'label') return row.label || '';
  return row[key];
};

/**
 * Flatten mapping + canonical values into bind/value pairs.
 * Slab rows match by salaryFrom/salaryTo/rate, not by index.
 */
export const collectBinds = (mapping, values) => {
  const binds = [];
  const scalars = mapping?.scalars || {};
  for (const [key, bind] of Object.entries(scalars)) {
    if (!bind) continue;
    binds.push({
      bind,
      value: values?.scalars?.[key] ?? '',
      fieldKey: key,
    });
  }

  for (const mapped of mapping?.slabs || []) {
    const computed = matchSlab(values?.slabs, mapped);
    const source = computed || {
      ...mapped,
      employeeCount: 0,
      exemptCount: 0,
      taxableCount: 0,
      taxAmount: 0,
    };
    for (const key of SLAB_KEYS) {
      const bind = mapped.binds?.[key];
      if (!bind) continue;
      binds.push({
        bind,
        value: slabFieldValue(source, key),
        fieldKey: key,
      });
    }
  }

  return binds;
};

const fillExcel = (buffer, mapping, values) => {
  const ordered = collectBinds(mapping, values).sort((a, b) => {
    const rank = (key) =>
      key === 'employerName' ? 0 : key === 'employerAddress' ? 1 : 2;
    return rank(a.fieldKey) - rank(b.fieldKey);
  });

  try {
    return fillExcelPreservingLayout(
      buffer,
      ordered.map((item) => ({ ...item, values })),
    );
  } catch {
    // Fallback for malformed packages — may drop styling.
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    for (const { bind, value, fieldKey } of ordered) {
      applyBind(workbook, bind, value, { fieldKey, values });
    }
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
};

const fillDocx = (buffer, mapping, values) => {
  const zip = new PizZip(buffer);
  const runValues = new Map();
  const tokenValues = new Map();
  for (const { bind, value } of collectBinds(mapping, values)) {
    if (isCellBind(bind)) continue;
    if (String(bind).startsWith('docx:')) {
      runValues.set(bind, value == null ? '' : String(value));
      continue;
    }
    const token = tokenFromBind(bind);
    if (!token) continue;
    tokenValues.set(token, value == null ? '' : String(value));
  }

  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (!file.name.startsWith('word/') || !file.name.endsWith('.xml')) continue;
    let xml = file.asText();
    if (file.name === 'word/document.xml' && runValues.size) {
      xml = replaceDocxRunGroups(xml, runValues);
    }
    for (const [token, value] of tokenValues.entries()) {
      const re = new RegExp(`\\{\\{\\s*${escapeRegex(token)}\\s*\\}\\}`, 'g');
      xml = xml.replace(re, escapeXml(value));
    }
    zip.file(file.name, xml);
  }

  return zip.generate({ type: 'nodebuffer' });
};

const wrapPdfText = (text, font, size, maxWidth) => {
  const words = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
};

const fillPdf = async (buffer, mapping, values) => {
  const pdf = await PDFDocument.load(buffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  for (const { bind, value } of collectBinds(mapping, values)) {
    const box = parsePdfBind(bind);
    if (!box) continue;
    const page = pages[box.page - 1];
    if (!page) continue;
    const text = value == null ? '' : String(value).slice(0, 180);
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      color: rgb(1, 1, 0.72),
    });
    const maxWidth = Math.max(8, box.w - 4);
    let size = Math.max(6, Math.min(11, box.h * 0.65));
    while (size > 6 && font.widthOfTextAtSize(text, size) > maxWidth && box.h < 22) {
      size -= 0.5;
    }
    const lines =
      box.h >= 22
        ? wrapPdfText(text, font, size, maxWidth).slice(
            0,
            Math.max(1, Math.floor((box.h - 2) / (size + 1))),
          )
        : [text];
    let cursorY =
      box.h >= 22
        ? box.y + box.h - size - 2
        : box.y + Math.max(2, (box.h - size) / 2);
    for (const rawLine of lines) {
      let line = rawLine;
      while (line.length > 1 && font.widthOfTextAtSize(line, size) > maxWidth) {
        line = line.slice(0, -1);
      }
      if (!line) continue;
      page.drawText(line, {
        x: box.x + 2,
        y: cursorY,
        size,
        font,
        color: rgb(0, 0, 0),
      });
      cursorY -= size + 1;
    }
  }
  return Buffer.from(await pdf.save());
};

export const filledExtension = (kind) => {
  if (kind === 'docx') return '.docx';
  if (kind === 'pdf') return '.pdf';
  if (kind === 'html') return '.html';
  return '.xlsx';
};

export const filledMimetype = (kind) => {
  if (kind === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'html') return 'text/html; charset=utf-8';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
};

/**
 * Fill a mapped Form 5 template. Layout comes from the file + mapping JSON,
 * never from district-specific code.
 */
export const fillTemplateBuffer = async ({
  buffer,
  kind,
  originalName = '',
  mapping,
  values,
}) => {
  const resolvedKind = kind || templateKindFromName(originalName);
  if (resolvedKind === 'html') {
    return fillHtmlBuffer(buffer, values);
  }
  if (resolvedKind === 'pdf') {
    return fillPdf(buffer, mapping, values);
  }
  if (resolvedKind === 'docx') {
    return fillDocx(buffer, mapping, values);
  }
  return fillExcel(buffer, mapping, values);
};
