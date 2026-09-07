import path from 'node:path';

import multer from 'multer';

import AppError from '../utils/AppError.js';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../utils/documentSecurity.js';
import { MAX_IMAGE_SIZE_BYTES } from '../utils/imageSecurity.js';

/**
 * Multer upload middleware (memory storage).
 * Declared mimetype is a first filter only — magic-byte sniffing happens in
 * storage.saveFile (images) / storage.saveDocument (office + PDF).
 */
const IMAGE_MIME_REGEX = /^image\/(jpeg|png|webp|gif)$/;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_REGEX.test(file.mimetype)) {
      return cb(null, true);
    }
    return cb(
      new AppError('Only JPEG, PNG, WEBP or GIF images are allowed', 422, {
        code: 'INVALID_FILE_TYPE',
      }),
    );
  },
});

const documentExtSet = new Set(ALLOWED_DOCUMENT_EXTENSIONS);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (documentExtSet.has(ext)) {
      return cb(null, true);
    }
    return cb(
      new AppError(
        'Only Excel (.xlsx, .xlsm, .xls), Word (.docx) or PDF files are allowed',
        422,
        { code: 'INVALID_FILE_TYPE' },
      ),
    );
  },
});

export const uploadImage = (fieldName) => imageUpload.single(fieldName);

/** Excel / Word / PDF ingest — used by uploads and templates in later phases. */
export const uploadDocument = (fieldName) => documentUpload.single(fieldName);
