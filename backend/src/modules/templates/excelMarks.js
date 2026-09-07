import PizZip from 'pizzip';
import * as XLSX from 'xlsx';

const WHITE_RGB = new Set([
  'FFFFFFFF',
  'FFFFFF',
  'FF000000', // treat pure black fill as non-mark
  '00000000',
]);

const decodeXml = (value) =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const colLettersToIndex = (letters) => {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
};

const parseFills = (stylesXml) => {
  const fills = [];
  for (const match of stylesXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)) {
    const xml = match[1];
    const rgb =
      xml.match(/fgColor[^>]*rgb="([^"]+)"/i)?.[1]?.toUpperCase() || null;
    const indexed = xml.match(/fgColor[^>]*indexed="([^"]+)"/i)?.[1] || null;
    const pattern =
      xml.match(/patternType="([^"]+)"/i)?.[1]?.toLowerCase() || 'none';
    fills.push({ rgb, indexed, pattern, xml });
  }
  return fills;
};

const parseCellXfs = (stylesXml) => {
  const block =
    stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || '';
  return [...block.matchAll(/<xf\b[^>]*\/?>/g)].map((match) => {
    const fillId = Number(match[0].match(/fillId="(\d+)"/)?.[1] ?? 0);
    return { fillId };
  });
};

const isMarkFill = (fill) => {
  if (!fill) return false;
  if (fill.pattern === 'none' || fill.pattern === 'gray125') return false;
  if (!fill.rgb) return false;
  const raw = fill.rgb.toUpperCase();
  const rgb = raw.startsWith('FF') && raw.length === 8 ? raw.slice(2) : raw;
  if (WHITE_RGB.has(raw) || rgb === 'FFFFFF' || rgb === '000000') return false;
  // Yellow and other highlight colours used as Form 5 variable markers.
  return true;
};

const looksLikeSampleValue = (text) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 600) return false;
  if (/^(employees whose|number of|rate of tax|form 5|return of tax payable by employer under)/i.test(
    value,
  )) {
    return false;
  }
  if (/name of the employer\s*:/i.test(value)) return true;
  if (/^(place|dt\.?)\s*:/i.test(value)) return true;
  if (/\b(shri|shree)\s+[A-Za-z]/i.test(value)) return true;
  if (/^(nil|\/\/\/+)$/i.test(value)) return true;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[.\s-]*\d{2}$/i.test(
    value.replace(/\s+/g, ''),
  )) {
    return true;
  }
  if (/^\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(value)) return true;
  if (/^\d+$/.test(value) && Number(value) < 100000) return true;
  if (/^(PRN?|PRC|KRN)/i.test(value.replace(/\s+/g, ''))) return true;
  return false;
};

const sharedStrings = (zip) => {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const xml = file.asText();
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    const texts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) =>
      decodeXml(t[1]),
    );
    return texts.join('');
  });
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
  return sheets;
};

const cellValueFromXml = (cellXml, strings) => {
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

/**
 * Collect yellow/coloured Excel cells and sample Form 5 values so
 * autoMapMarks can bind without requiring {{placeholders}}.
 */
export const extractExcelMarks = (buffer) => {
  const warnings = [];
  let zip;
  try {
    zip = new PizZip(buffer);
  } catch {
    return {
      cells: [],
      warnings: ['Could not read Excel package for colour marks.'],
    };
  }

  const stylesFile = zip.file('xl/styles.xml');
  if (!stylesFile) {
    return { cells: [], warnings: ['Excel file has no styles.xml.'] };
  }

  const fills = parseFills(stylesFile.asText());
  const xfs = parseCellXfs(stylesFile.asText());
  const strings = sharedStrings(zip);
  const sheets = sheetPaths(zip);
  if (!sheets.length) {
    // fallback: Sheet1
    const fallback = zip.file('xl/worksheets/sheet1.xml');
    if (fallback) sheets.push({ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' });
  }

  const byBind = new Map();
  const pushCell = (cell) => {
    if (!cell.value && !cell.colored) return;
    const existing = byBind.get(cell.bind);
    if (existing) {
      existing.colored = existing.colored || cell.colored;
      if (!existing.value && cell.value) existing.value = cell.value;
      return;
    }
    byBind.set(cell.bind, cell);
  };

  for (const sheet of sheets) {
    const xml = zip.file(sheet.path)?.asText();
    if (!xml) continue;
    for (const match of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+)(\d+)"([^/]*)\/>/g)) {
      const col = match[1] || match[5];
      const row = match[2] || match[6];
      const attrs = match[3] || match[7] || '';
      const body = match[4] || '';
      const address = `${col}${row}`;
      const styleIndex = attrs.match(/s="(\d+)"/)?.[1];
      const fill =
        styleIndex != null ? fills[xfs[Number(styleIndex)]?.fillId] : null;
      const colored = isMarkFill(fill);
      const value = cellValueFromXml(
        `<c${attrs}>${body}</c>`,
        strings,
      ).replace(/\s+/g, ' ').trim();
      const sample = looksLikeSampleValue(value);
      if (!colored && !sample) continue;
      const bind = sheets.length > 1 ? `${sheet.name}!${address}` : address;
      pushCell({
        sheet: sheet.name,
        address,
        bind,
        value,
        tokens: [],
        colored,
        col: colLettersToIndex(col),
        row: Number(row),
      });
    }
  }

  // Also pull sample values SheetJS can see (covers shared-string edge cases)
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      for (const address of Object.keys(sheet)) {
        if (address.startsWith('!')) continue;
        const text = String(sheet[address]?.w ?? sheet[address]?.v ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!looksLikeSampleValue(text)) continue;
        const bind =
          workbook.SheetNames.length > 1 ? `${sheetName}!${address}` : address;
        pushCell({
          sheet: sheetName,
          address,
          bind,
          value: text,
          tokens: [],
          colored: byBind.get(bind)?.colored || false,
        });
      }
    }
  } catch {
    warnings.push('Could not cross-check Excel sample values.');
  }

  const cells = [...byBind.values()].filter((cell) => cell.value);
  if (!cells.length) {
    warnings.push(
      'No coloured or sample value cells found. Add yellow fills on changeable cells, or use {{placeholders}}.',
    );
  } else if (!cells.some((cell) => cell.colored)) {
    warnings.push(
      'No yellow/coloured cells found — mapped from sample values in the template.',
    );
  }

  return { cells, warnings };
};

/**
 * When a Form 5 narrative cell holds labels + sample values, substitute
 * only the variable parts instead of wiping the labels.
 */
export const substituteForm5CellText = (existing, fieldKey, nextValue, values) => {
  const text = String(existing ?? '');
  const value = nextValue == null ? '' : String(nextValue);
  if (!text.trim()) return value;

  if (/name of the employer\s*:/i.test(text)) {
    let out = text;
    if (fieldKey === 'employerName' || fieldKey === 'employerAddress') {
      const name = String(values?.scalars?.employerName ?? value);
      const address = String(values?.scalars?.employerAddress ?? '');
      out = out.replace(
        /(Name of the Employer\s*:\s*)([^\r\n]*)/i,
        `$1${name}`,
      );
      if (/Address\s*:/i.test(out)) {
        out = out.replace(/(Address\s*:\s*)([^\r\n]*)/i, `$1${address}`);
      }
      return out;
    }
  }

  if (fieldKey === 'place' && /^place\s*:/i.test(text.trim())) {
    return text.replace(/^(Place\s*:\s*)(.*)$/i, `$1${value}`);
  }

  if (fieldKey === 'filingDate' && /^dt\.?\s*:/i.test(text.trim())) {
    return text.replace(/^(Dt\.?\s*:\s*)(.*)$/i, `$1${value}`);
  }

  if (
    fieldKey === 'signatoryName' &&
    /\b(shri|shree)\b/i.test(text)
  ) {
    return text.replace(
      /((?:I\.\s*)?(?:Shri|Shree)\s+)([^.]*)/i,
      `$1${value.replace(/^(Shri|Shree)\s+/i, '')}`,
    );
  }

  return value;
};
