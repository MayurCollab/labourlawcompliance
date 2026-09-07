import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDocument } from '../utils/documentSecurity.js';
import { validateAndProcessImage } from '../utils/imageSecurity.js';
import AppError from '../utils/AppError.js';

/**
 * Local disk storage provider — writes into backend/uploads/.
 * Images are magic-byte validated and EXIF-stripped before write.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Persist a file buffer. Returns the public path (e.g. /uploads/avatars/x.png)
 * served via the controlled upload route (not express.static).
 */
export const saveFile = async ({ buffer, mimetype, folder = '' }) => {
  const processed = await validateAndProcessImage(buffer, mimetype);
  const extension = EXTENSION_BY_MIME[processed.mimetype] || '';
  const filename = `${randomUUID()}${extension}`;

  const directory = path.join(UPLOADS_ROOT, folder);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), processed.buffer);

  return {
    path: `/uploads/${folder ? `${folder}/` : ''}${filename}`,
    mimetype: processed.mimetype,
  };
};

/**
 * Persist an Excel / Word / PDF buffer after magic-byte validation.
 * Documents are not served by the public /uploads image route — later phases
 * download them through authenticated module endpoints.
 */
export const saveDocument = async ({
  buffer,
  mimetype,
  folder = 'documents',
  originalName = '',
}) => {
  const processed = await validateDocument(buffer, mimetype, originalName);
  const filename = `${randomUUID()}${processed.extension}`;

  const directory = path.join(UPLOADS_ROOT, folder);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), processed.buffer);

  return {
    path: `/uploads/${folder ? `${folder}/` : ''}${filename}`,
    mimetype: processed.mimetype,
    originalName: processed.originalName,
    size: processed.buffer.length,
  };
};

/** Delete a previously stored file by its public path. Missing files are ignored. */
export const deleteFile = async (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;

  const relative = publicPath.slice('/uploads/'.length);
  const absolute = path.resolve(UPLOADS_ROOT, relative);

  if (!absolute.startsWith(UPLOADS_ROOT)) return;

  await fs.rm(absolute, { force: true });
};

/**
 * Read a previously stored file by its public path. Used to re-parse an
 * uploaded workbook without asking the user to send the bytes again.
 */
export const readFileBuffer = async (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/uploads/')) {
    throw new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
  }

  const relative = publicPath.slice('/uploads/'.length);
  const absolute = path.resolve(UPLOADS_ROOT, relative);

  if (!absolute.startsWith(UPLOADS_ROOT)) {
    throw new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
  }

  try {
    return await fs.readFile(absolute);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
    }
    throw error;
  }
};
