import path from 'node:path';

import { fileTypeFromBuffer } from 'file-type';

import AppError from './AppError.js';

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Allowed office/PDF documents for MasterSheet, salary, and Form 5 templates.
 * Magic-byte check is authoritative; client mimetype is a hint only.
 */
const ALLOWED_BY_EXT = new Map([
  [
    '.xlsx',
    {
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      detected: new Set([
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-zip-compressed',
      ]),
    },
  ],
  [
    '.xlsm',
    {
      mime: 'application/vnd.ms-excel.sheet.macroEnabled.12',
      detected: new Set([
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-zip-compressed',
      ]),
    },
  ],
  [
    '.xls',
    {
      mime: 'application/vnd.ms-excel',
      detected: new Set([
        'application/vnd.ms-excel',
        'application/x-cfb',
        'application/vnd.ms-office',
      ]),
    },
  ],
  [
    '.docx',
    {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      detected: new Set([
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/x-zip-compressed',
      ]),
    },
  ],
  [
    '.pdf',
    {
      mime: 'application/pdf',
      detected: new Set(['application/pdf']),
    },
  ],
]);

const MIME_TO_EXT = new Map(
  [...ALLOWED_BY_EXT.entries()].map(([ext, spec]) => [spec.mime.toLowerCase(), ext]),
);
MIME_TO_EXT.set('application/vnd.ms-excel.sheet.macroenabled.12', '.xlsm');

export const MAX_DOCUMENT_SIZE_BYTES = MAX_BYTES;

export const ALLOWED_DOCUMENT_EXTENSIONS = [...ALLOWED_BY_EXT.keys()];

const INVALID_TYPE_MESSAGE =
  'Only Excel (.xlsx, .xlsm, .xls), Word (.docx) or PDF files are allowed';

const sanitizeOriginalName = (originalName = '') => {
  const base = path.basename(String(originalName).replace(/\\/g, '/'));
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180);
  return cleaned || 'document';
};

const extensionFromName = (originalName = '') =>
  path.extname(sanitizeOriginalName(originalName)).toLowerCase();

/**
 * Validate a document buffer by size + magic bytes. Does not re-encode.
 * Returns the original buffer with a canonical mimetype and extension.
 */
export const validateDocument = async (buffer, _claimedMime, originalName = '') => {
  if (!buffer?.length) {
    throw new AppError('A document file is required', 422, {
      code: 'FILE_REQUIRED',
    });
  }

  if (buffer.length > MAX_BYTES) {
    throw new AppError('File is too large (max 20 MB)', 422, {
      code: 'FILE_TOO_LARGE',
    });
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new AppError(INVALID_TYPE_MESSAGE, 422, {
      code: 'INVALID_FILE_TYPE',
    });
  }

  let extension = extensionFromName(originalName);
  if (!ALLOWED_BY_EXT.has(extension)) {
    extension = MIME_TO_EXT.get(detected.mime.toLowerCase()) || '';
  }

  const spec = ALLOWED_BY_EXT.get(extension);
  if (!spec || !spec.detected.has(detected.mime)) {
    throw new AppError(INVALID_TYPE_MESSAGE, 422, {
      code: 'INVALID_FILE_TYPE',
    });
  }

  return {
    buffer,
    mimetype: spec.mime,
    extension,
    originalName: sanitizeOriginalName(originalName),
  };
};
