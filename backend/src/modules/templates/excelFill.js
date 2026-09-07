import PizZip from 'pizzip';

import { substituteForm5CellText } from './excelMarks.js';

const SST_NS =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const decodeXml = (value) =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const WHITE_OR_NONE = new Set([
  'FFFFFFFF',
  'FFFFFF',
  'FF000000',
  '000000',
  '00000000',
]);

const isMarkRgb = (rgb) => {
  if (!rgb) return false;
  const raw = String(rgb).toUpperCase();
  const hex = raw.startsWith('FF') && raw.length === 8 ? raw.slice(2) : raw;
  if (WHITE_OR_NONE.has(raw) || WHITE_OR_NONE.has(hex)) return false;
  return true;
};

const sheetPaths = (zip) => {
  const workbook = zip.file('xl/workbook.xml')?.asText() || '';
  const rels = zip.file('xl/_rels/workbook.xml.rels')?.asText() || '';
  const relMap = Object.fromEntries(
    [...rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [
      m[1],
      m[2].replace(/^\//, '').replace(/^xl\//, ''),
    ]),
  );
  const sheets = [];
  for (const match of workbook.matchAll(
    /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g,
  )) {
    const target = relMap[match[2]];
    if (!target) continue;
    sheets.push({
      name: decodeXml(match[1]),
      path: target.startsWith('xl/') ? target : `xl/${target}`,
    });
  }
  if (!sheets.length) {
    const fallback = zip.file('xl/worksheets/sheet1.xml');
    if (fallback) {
      sheets.push({ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' });
    }
  }
  return sheets;
};

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    const texts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) =>
      decodeXml(t[1]),
    );
    return texts.join('');
  });
};

const cellText = (cellXml, strings) => {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1] || '';
  const v = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  const is = cellXml.match(/<is>([\s\S]*?)<\/is>/)?.[1];
  if (type === 's' && v != null) return strings[Number(v)] ?? '';
  if (type === 'inlineStr' && is) {
    return [...is.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((t) => decodeXml(t[1]))
      .join('');
  }
  if (v != null) return decodeXml(v);
  return '';
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

const findSheet = (sheets, sheetName) => {
  if (!sheets.length) return null;
  if (!sheetName) return sheets[0];
  return (
    sheets.find((s) => s.name === sheetName) ||
    sheets.find((s) => s.name.toLowerCase() === sheetName.toLowerCase()) ||
    sheets[0]
  );
};

const isNumericValue = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const ensureSharedStringsPart = (zip, stringsXml) => {
  if (zip.file('xl/sharedStrings.xml')) return stringsXml;

  const empty = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${SST_NS}" count="0" uniqueCount="0"></sst>`;
  zip.file('xl/sharedStrings.xml', empty);

  const relsPath = 'xl/_rels/workbook.xml.rels';
  let rels = zip.file(relsPath)?.asText() || '';
  if (rels && !rels.includes('sharedStrings.xml')) {
    const nextId =
      Math.max(
        0,
        ...[...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1])),
      ) + 1;
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    );
    zip.file(relsPath, rels);
  }

  const typesPath = '[Content_Types].xml';
  let types = zip.file(typesPath)?.asText() || '';
  if (types && !types.includes('/xl/sharedStrings.xml')) {
    types = types.replace(
      '</Types>',
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    );
    zip.file(typesPath, types);
  }

  return empty;
};

/**
 * Append a shared string and return its index. Mutates strings[] for reads.
 */
const appendSharedString = (stringsXml, strings, text) => {
  const value = text == null ? '' : String(text);
  const index = strings.length;
  strings.push(value);
  const si = `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`;
  let xml = stringsXml || emptySharedStrings();
  const unique = strings.length;
  const countMatch = xml.match(/\bcount="(\d+)"/);
  const prevCount = Number(countMatch?.[1] || unique - 1);
  xml = xml
    .replace(/\bcount="\d+"/, `count="${prevCount + 1}"`)
    .replace(/\buniqueCount="\d+"/, `uniqueCount="${unique}"`);
  if (!xml.includes('</sst>')) {
    xml = `${xml.replace(/\/>\s*$/, '>')}${si}</sst>`;
  } else {
    xml = xml.replace('</sst>', `${si}</sst>`);
  }
  return { xml, index };
};

const emptySharedStrings = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${SST_NS}" count="0" uniqueCount="0"></sst>`;

const buildCellXml = (address, attrs, value, stringIndex) => {
  // Original cells are often self-closing (`<c r="A1" s="3"/>`). The captured
  // attrs must not keep the trailing "/", or we emit broken XML like
  // `<c r="A1" s="3"/ t="s"><v>0</v></c>`.
  const cleaned = String(attrs || '')
    .replace(/\bt="[^"]*"/g, '')
    .replace(/\/\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const attrPrefix = cleaned ? ` ${cleaned}` : '';

  if (isNumericValue(value)) {
    return `<c r="${address}"${attrPrefix}><v>${value}</v></c>`;
  }

  return `<c r="${address}"${attrPrefix} t="s"><v>${stringIndex}</v></c>`;
};

const setCellInSheet = (sheetXml, address, value, stringIndex) => {
  // Do not let [^>]* swallow the self-closing slash before "/>".
  const re = new RegExp(
    `<c r="${address}"([^>/]*)(?:\\s*/>|>([\\s\\S]*?)</c>)`,
    'i',
  );
  const match = sheetXml.match(re);
  const cell = buildCellXml(address, match?.[1] || '', value, stringIndex);
  if (match) {
    return sheetXml.replace(re, () => cell);
  }
  if (!sheetXml.includes('</sheetData>')) return sheetXml;
  return sheetXml.replace('</sheetData>', `${cell}</sheetData>`);
};

const readCellInSheet = (sheetXml, address, strings) => {
  const re = new RegExp(
    `<c r="${address}"([^>/]*)(?:\\s*/>|>([\\s\\S]*?)</c>)`,
    'i',
  );
  const match = sheetXml.match(re);
  if (!match) return '';
  return cellText(
    `<c r="${address}"${match[1] || ''}>${match[2] || ''}</c>`,
    strings,
  );
};

const resetSheetView = (sheetXml) =>
  sheetXml
    .replace(/\btopLeftCell="[^"]*"/g, 'topLeftCell="A1"')
    .replace(
      /<selection\b[^>]*\/>/g,
      '<selection activeCell="A1" sqref="A1"/>',
    );

/**
 * Remove yellow / highlight fills used only as mapping marks so the
 * filled Form 5 prints like a blank official return.
 */
export const stripExcelMarkFills = (stylesXml) =>
  stylesXml.replace(/<fill>([\s\S]*?)<\/fill>/g, (full, inner) => {
    const pattern =
      inner.match(/patternType="([^"]+)"/i)?.[1]?.toLowerCase() || 'none';
    if (pattern === 'none' || pattern === 'gray125') return full;
    const rgb = inner.match(/fgColor[^>]*rgb="([^"]+)"/i)?.[1];
    if (!isMarkRgb(rgb)) return full;
    return '<fill><patternFill patternType="none"/></fill>';
  });

const replaceTokenEverywhere = (zip, sheets, stringsXml, token, value) => {
  const alt = new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'g');
  const replacement = escapeXml(value == null ? '' : String(value));
  let nextStrings = stringsXml;
  let changed = false;

  if (nextStrings && alt.test(nextStrings)) {
    alt.lastIndex = 0;
    nextStrings = nextStrings.replace(alt, () => {
      changed = true;
      return replacement;
    });
  }

  for (const sheet of sheets) {
    let xml = zip.file(sheet.path)?.asText();
    if (!xml) continue;
    alt.lastIndex = 0;
    if (!alt.test(xml)) continue;
    alt.lastIndex = 0;
    xml = xml.replace(alt, () => {
      changed = true;
      return replacement;
    });
    zip.file(sheet.path, xml);
  }

  return { stringsXml: nextStrings, changed };
};

/**
 * Fill mapped cells inside the original XLSX package so borders, fonts,
 * column widths, row heights, and drawings (logo) are preserved.
 */
export const fillExcelPreservingLayout = (buffer, binds) => {
  const zip = new PizZip(buffer);
  const sheets = sheetPaths(zip);
  if (!sheets.length) {
    throw new Error('Excel workbook has no worksheets');
  }

  let stringsXml = zip.file('xl/sharedStrings.xml')?.asText() || null;
  stringsXml = ensureSharedStringsPart(zip, stringsXml);
  const strings = parseSharedStrings(stringsXml || '');

  const sheetXmlByPath = new Map();
  for (const sheet of sheets) {
    const xml = zip.file(sheet.path)?.asText();
    if (xml) sheetXmlByPath.set(sheet.path, xml);
  }

  for (const { bind, value, fieldKey, values } of binds) {
    const rawBind = String(bind || '').trim();
    if (!rawBind) continue;

    if (rawBind.includes('{{')) {
      const token = rawBind.replace(/^\{\{|\}\}$/g, '').trim();
      if (!token) continue;
      const result = replaceTokenEverywhere(
        zip,
        sheets,
        stringsXml,
        token,
        value,
      );
      stringsXml = result.stringsXml;
      for (const sheet of sheets) {
        const xml = zip.file(sheet.path)?.asText();
        if (xml) sheetXmlByPath.set(sheet.path, xml);
      }
      continue;
    }

    if (!/^(?:[^!]+!)?[A-Za-z]+\d+$/.test(rawBind)) {
      const result = replaceTokenEverywhere(
        zip,
        sheets,
        stringsXml,
        rawBind,
        value,
      );
      stringsXml = result.stringsXml;
      for (const sheet of sheets) {
        const xml = zip.file(sheet.path)?.asText();
        if (xml) sheetXmlByPath.set(sheet.path, xml);
      }
      continue;
    }

    const { sheet: sheetName, address } = parseCellBind(rawBind);
    const sheet = findSheet(sheets, sheetName);
    if (!sheet) continue;
    let xml = sheetXmlByPath.get(sheet.path);
    if (!xml) continue;

    let next = value ?? '';
    const existing = readCellInSheet(xml, address, strings);
    if (fieldKey && existing) {
      next = substituteForm5CellText(existing, fieldKey, value, values);
    }

    let stringIndex = null;
    if (!isNumericValue(next)) {
      const appended = appendSharedString(stringsXml, strings, next);
      stringsXml = appended.xml;
      stringIndex = appended.index;
    }
    xml = setCellInSheet(xml, address, next, stringIndex);
    sheetXmlByPath.set(sheet.path, xml);
  }

  for (const [path, xml] of sheetXmlByPath) {
    zip.file(path, resetSheetView(xml));
  }
  zip.file('xl/sharedStrings.xml', stringsXml);

  const stylesPath = 'xl/styles.xml';
  const styles = zip.file(stylesPath)?.asText();
  if (styles) {
    zip.file(stylesPath, stripExcelMarkFills(styles));
  }

  // Stale calc chain can confuse Excel after cell rewrites.
  if (zip.file('xl/calcChain.xml')) {
    zip.remove('xl/calcChain.xml');
  }

  return Buffer.from(
    zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
  );
};
