import path from 'node:path';

import asyncHandler from './asyncHandler.js';
import AppError from '../utils/AppError.js';
import storage from '../storage/index.js';

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Controlled file delivery — never expose a browsable/executable static tree.
 * Works with both local disk and S3; documents are not served here.
 * Mount with: app.use('/uploads', serveUploadMiddleware)
 */
export const serveUploadMiddleware = asyncHandler(async (req, res) => {
  const relative = decodeURIComponent(String(req.path || '').replace(/^\/+/, ''));

  if (
    !relative ||
    relative.includes('\0') ||
    relative.includes('..') ||
    relative.includes('\\')
  ) {
    throw new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
  }

  const ext = path.posix.extname(relative).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    throw new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
  }

  const buffer = await storage.readFileBuffer(`/uploads/${relative}`);

  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Length', String(buffer.length));

  return res.send(buffer);
});
