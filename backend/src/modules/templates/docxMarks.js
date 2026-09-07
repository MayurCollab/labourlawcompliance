const decodeXml = (value) =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const encodeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const RUN_RE = /<w:r[ >][\s\S]*?<\/w:r>/g;
const LATIN_FONT = /verdana|arial|calibri|times|tahoma|cambria|tahoma/i;
const LEGACY_GUJARATI = /saral|gujrati|gujarati|shruti/i;

const runMeta = (xml, index) => {
  const texts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) =>
    decodeXml(m[1]),
  );
  return {
    index,
    xml,
    text: texts.join(''),
    font:
      xml.match(/w:ascii="([^"]+)"/)?.[1] ||
      xml.match(/w:hAnsi="([^"]+)"/)?.[1] ||
      '',
    highlight: xml.match(/w:highlight w:val="([^"]+)"/)?.[1] || '',
    color: (xml.match(/w:color w:val="([^"]+)"/)?.[1] || '').toUpperCase(),
  };
};

const isColored = (run) => {
  const color = run.color;
  return Boolean(
    color && color !== 'AUTO' && color !== '000000' && color !== 'BLACK',
  );
};

const isMarkable = (run, { preferHighlight }) => {
  if (run.highlight) return true;
  if (isColored(run)) return true;
  if (preferHighlight) return false;
  if (!LATIN_FONT.test(run.font)) return false;
  return /[A-Za-z0-9]/.test(run.text);
};

const collapseGroup = (runs) => {
  const text = runs.map((run) => run.text).join('').replace(/\s+/g, ' ').trim();
  const start = runs[0].index;
  const end = runs[runs.length - 1].index;
  const highlight = runs.find((run) => run.highlight)?.highlight || '';
  return {
    bind: `docx:${start}-${end}`,
    value: text,
    tokens: [],
    sheet: highlight ? `highlight:${highlight}` : 'docx',
    address: `${start}-${end}`,
    highlight,
    font: runs[0].font,
  };
};

/**
 * Gujarati district Word files store labels in Gujrati Saral-1 and the
 * changeable English/number values in Verdana. Jamnagar-style files also
 * yellow-highlight those values. Groups of adjacent marked runs become
 * bind targets the mapper can attach to canonical fields.
 */
export const extractDocxMarks = (documentXml) => {
  const xml = String(documentXml || '');
  const runs = [];
  const walker = new RegExp(RUN_RE.source, 'g');
  const boundaries = [];
  let match;
  let prevEnd = 0;
  while ((match = walker.exec(xml))) {
    boundaries.push(xml.slice(prevEnd, match.index).includes('</w:p>'));
    prevEnd = match.index + match[0].length;
    runs.push(runMeta(match[0], runs.length));
  }

  const hasHighlight = runs.some((run) => run.highlight);
  const hasColor = runs.some(isColored);
  const preferHighlight = hasHighlight || hasColor;
  const warnings = [];
  if (runs.some((run) => LEGACY_GUJARATI.test(run.font))) {
    warnings.push(
      'This Word file uses a legacy Gujarati font. Static Gujarati labels stay as-is. Map the highlighted, coloured, or English data fields.',
    );
  }

  const groups = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const group = collapseGroup(current);
    current = [];
    if (!group.value) return;
    if (/<w:/.test(group.value)) return;
    if (group.value.length === 1 && !/\d/.test(group.value)) return;
    groups.push(group);
  };

  runs.forEach((run, index) => {
    if (boundaries[index]) flush();
    if (isMarkable(run, { preferHighlight })) {
      current.push(run);
    } else {
      flush();
    }
  });
  flush();

  const cells = groups.slice(0, 80);
  if (!hasHighlight && !hasColor && cells.length) {
    warnings.push(
      'No {{placeholders}} or highlights found. English / number sample values were offered as fill targets.',
    );
  } else if (hasHighlight) {
    warnings.push(
      'Yellow (or other) highlighted runs are the changeable fields. Bind those to canonical Form 5 keys.',
    );
  }
  if (groups.length > 40) {
    warnings.push(
      'This Word file has many English data runs — it may contain several filled employer copies. Map the first block; later copies stay as extra bind options.',
    );
  }

  return { cells, warnings, runCount: runs.length };
};

export const replaceDocxRunGroups = (documentXml, replacements) => {
  const xml = String(documentXml || '');
  const ranges = [...replacements.entries()].map(([bind, value]) => {
    const match = String(bind).match(/^docx:(\d+)-(\d+)$/);
    if (!match) return null;
    return {
      start: Number(match[1]),
      end: Number(match[2]),
      value: value == null ? '' : String(value),
    };
  }).filter(Boolean);

  if (!ranges.length) return xml;

  let index = 0;
  return xml.replace(RUN_RE, (run) => {
    const current = index;
    index += 1;
    const hit = ranges.find(
      (range) => current >= range.start && current <= range.end,
    );
    if (!hit) return run;
    if (current !== hit.start) {
      return run.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/g, '<w:t$1></w:t>');
    }
    if (/<w:t[\s>]/.test(run)) {
      return run.replace(
        /<w:t([^>]*)>[\s\S]*?<\/w:t>/,
        `<w:t xml:space="preserve">${encodeXml(hit.value)}</w:t>`,
      );
    }
    return run.replace(/<\/w:r>/, `<w:t xml:space="preserve">${encodeXml(hit.value)}</w:t></w:r>`);
  });
};
