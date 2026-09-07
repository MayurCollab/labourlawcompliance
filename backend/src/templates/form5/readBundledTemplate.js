import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import AppError from '../../utils/AppError.js';
import { TEMPLATES_CODES } from '../../modules/templates/templates.constants.js';
import {
  BUNDLED_FORM5_BY_CODE,
  codeFromBundledPath,
} from './bundledTemplates.constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FORM5_HTML_ROOT = path.resolve(__dirname, 'html');
export const FORM5_ASSETS_ROOT = path.resolve(__dirname, 'assets');
const SIGNATURE_FILE = 'signatory-signature.png';
const MEHSANA_HEADER_FILE = 'mehsana-header.png';

const assetDataUriCache = new Map();

const mimeForAsset = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
};

/** PDF-safe data URI for a file under form5/assets. Empty string if missing. */
export const readBundledAssetDataUri = async (filename) => {
  const key = String(filename || '').trim();
  if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
    return '';
  }
  if (assetDataUriCache.has(key)) return assetDataUriCache.get(key);
  const filePath = path.join(FORM5_ASSETS_ROOT, key);
  try {
    const buffer = await fs.readFile(filePath);
    const uri = `data:${mimeForAsset(key)};base64,${buffer.toString('base64')}`;
    assetDataUriCache.set(key, uri);
    return uri;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      assetDataUriCache.set(key, '');
      return '';
    }
    throw error;
  }
};

export const isBundledStoredPath = (storedPath) =>
  String(storedPath || '').startsWith('bundled:');

export const resolveBundledTemplatePath = (codeOrPath) => {
  const code = isBundledStoredPath(codeOrPath)
    ? codeFromBundledPath(codeOrPath)
    : String(codeOrPath || '').trim();
  const entry = BUNDLED_FORM5_BY_CODE.get(code);
  if (!entry) return null;
  return path.join(FORM5_HTML_ROOT, entry.file);
};

export const readBundledTemplateBuffer = async (codeOrPath) => {
  const filePath = resolveBundledTemplatePath(codeOrPath);
  if (!filePath) {
    throw new AppError('Bundled Form 5 template not found', 404, {
      code: TEMPLATES_CODES.TEMPLATE_NOT_FOUND,
    });
  }
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new AppError('Bundled Form 5 template file is missing', 404, {
        code: TEMPLATES_CODES.TEMPLATE_NOT_FOUND,
      });
    }
    throw error;
  }
};

export const readBundledPartials = async () => {
  const partialsDir = path.join(FORM5_HTML_ROOT, 'partials');
  const entries = await fs.readdir(partialsDir).catch(() => []);
  const partials = {};
  for (const file of entries) {
    if (!/\.(html|hbs)$/i.test(file)) continue;
    const name = file.replace(/\.(html|hbs)$/i, '');
    partials[name] = await fs.readFile(path.join(partialsDir, file), 'utf8');
  }
  return partials;
};

/** Data URI for the bundled Form 5 signatory signature (PDF-safe inline image). */
export const readBundledSignatureDataUri = async () =>
  readBundledAssetDataUri(SIGNATURE_FILE);

/** Data URI for the Mehsana Municipal Corporation Form-5 header banner. */
export const readBundledMehsanaHeaderDataUri = async () =>
  readBundledAssetDataUri(MEHSANA_HEADER_FILE);

/** Reset cached signature (tests only). */
export const resetBundledSignatureCacheForTests = () => {
  assetDataUriCache.clear();
};
