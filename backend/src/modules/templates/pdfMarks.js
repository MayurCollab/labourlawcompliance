import './canvasPolyfill.js';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const hexToRgb = (hex) => {
  const raw = String(hex || '').replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const toRgb = (args = []) => {
  if (typeof args[0] === 'string' && args[0].startsWith('#')) {
    return hexToRgb(args[0]) || [0, 0, 0];
  }
  if (args.length >= 3) {
    return [Number(args[0]), Number(args[1]), Number(args[2])];
  }
  if (args.length === 1 && typeof args[0] === 'number') {
    const gray = Number(args[0]);
    return [gray, gray, gray];
  }
  return [0, 0, 0];
};

const isMarkColor = (rgb) => {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  if (r > 0.95 && g > 0.95 && b > 0.95) return false;
  const yellow = r > 0.85 && g > 0.85 && b < 0.35;
  const tinted = Math.max(r, g, b) - Math.min(r, g, b) > 0.12;
  return yellow || tinted;
};

const colorLabel = (rgb) => {
  const [r, g, b] = rgb;
  if (r > 0.85 && g > 0.85 && b < 0.35) return 'yellow';
  if (r > 0.6 && g < 0.45) return 'red';
  if (b > 0.6 && r < 0.6) return 'blue';
  return `rgb(${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)})`;
};

const boxFromConstructArgs = (args) => {
  const bbox = args?.[2];
  if (!bbox) return null;
  const x0 = Number(bbox[0]);
  const y0 = Number(bbox[1]);
  const x1 = Number(bbox[2]);
  const y1 = Number(bbox[3]);
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
};

const boxesFromOps = (fnArray, argsArray) => {
  let rgb = [0, 0, 0];
  const boxes = [];
  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] || [];
    if (fn === OPS.setFillRGBColor || fn === OPS.setFillGray) {
      rgb = toRgb(args);
      continue;
    }
    if (fn !== OPS.constructPath) continue;
    const box = boxFromConstructArgs(args);
    if (!box || !isMarkColor(rgb) || box.w < 8 || box.h < 6) continue;
    boxes.push({
      ...box,
      rgb: [...rgb],
      label: colorLabel(rgb),
    });
  }
  return boxes;
};

const itemBox = (item) => {
  const t = item.transform || [1, 0, 0, 1, 0, 0];
  const x = t[4];
  const y = t[5];
  const w = item.width || 0;
  const h = item.height || Math.abs(t[3]) || 10;
  return { x, y, w, h, text: String(item.str || '') };
};

const overlaps = (text, box) => {
  const tx = text.x + text.w / 2;
  const ty = text.y + text.h / 2;
  return (
    tx >= box.x - 1 &&
    tx <= box.x + box.w + 1 &&
    ty >= box.y - 1 &&
    ty <= box.y + box.h + 1
  );
};

const loadPdf = (buffer) =>
  getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

/**
 * Coloured boxes (yellow and other highlight fills) are the changeable
 * fields. Text sitting in a box is the sample value for the mapper.
 */
export const extractPdfMarks = async (buffer) => {
  const pdf = await loadPdf(buffer);
  const cells = [];
  const warnings = [
    'Coloured boxes in this PDF are treated as changeable fields. Bind each box to a canonical Form 5 key.',
  ];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const [opList, textContent] = await Promise.all([
        page.getOperatorList(),
        page.getTextContent(),
      ]);
      const boxes = boxesFromOps(opList.fnArray, opList.argsArray);
      const texts = (textContent.items || [])
        .filter((item) => item.str && String(item.str).trim())
        .map(itemBox);

      boxes.forEach((box, boxIndex) => {
        const inside = texts
          .filter((text) => overlaps(text, box))
          .sort((a, b) => a.x - b.x);
        const value = inside
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const bind = [
          'pdf',
          pageNumber,
          box.x.toFixed(1),
          box.y.toFixed(1),
          box.w.toFixed(1),
          box.h.toFixed(1),
        ].join(':');
        cells.push({
          bind,
          value,
          tokens: [],
          sheet: `page-${pageNumber}`,
          address: `${box.label}-${boxIndex + 1}`,
          page: pageNumber,
          box,
        });
      });
    }
  } finally {
    if (typeof pdf?.cleanup === 'function') {
      await pdf.cleanup();
    }
    if (typeof pdf?.destroy === 'function') {
      await pdf.destroy();
    }
  }

  if (!cells.length) {
    warnings.push(
      'No coloured highlight boxes were found. Draw yellow (or other) boxes over the changeable fields and upload again, or bind Excel/Word instead.',
    );
  } else if (
    cells.some((cell) =>
      /name of the employer|return of tax payable|address\s*:/i.test(cell.value),
    )
  ) {
    warnings.push(
      'Some colour boxes also cover printed labels. Draw tighter boxes around only the values that change, or generate will paint over those labels.',
    );
  }

  return { cells: cells.slice(0, 80), warnings };
};

export const parsePdfBind = (bind) => {
  const match = String(bind || '').match(
    /^pdf:(\d+):([-\d.]+):([-\d.]+):([-\d.]+):([-\d.]+)$/,
  );
  if (!match) return null;
  return {
    page: Number(match[1]),
    x: Number(match[2]),
    y: Number(match[3]),
    w: Number(match[4]),
    h: Number(match[5]),
  };
};
