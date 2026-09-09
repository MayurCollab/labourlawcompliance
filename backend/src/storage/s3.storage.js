import { randomBytes } from 'node:crypto';
import path from 'node:path';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import config from '../config/index.js';
import { validateDocument } from '../utils/documentSecurity.js';
import { validateAndProcessImage } from '../utils/imageSecurity.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * S3 storage provider — same interface as local.storage.js.
 * Returns a virtual-hosted S3 HTTPS URL as `path` (stored in MongoDB).
 * Objects stay private; download via authenticated API / /uploads proxy.
 */

const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const UPLOADS_PREFIX = '/uploads/';

let client;

const getClient = () => {
  if (!client) {
    const { region, accessKeyId, secretAccessKey } = config.storage.s3;
    client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return client;
};

const bucket = () => config.storage.s3.bucket;
const region = () => config.storage.s3.region;

/** Virtual-hosted-style object URL stored in MongoDB. */
export const objectUrlForKey = (key) => {
  const encodedKey = String(key)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `https://${bucket()}.s3.${region()}.amazonaws.com/${encodedKey}`;
};

const isSafeRelativeKey = (relative) =>
  Boolean(relative) &&
  !relative.includes('\0') &&
  !relative.includes('..') &&
  !relative.includes('\\');

/**
 * Build a readable object filename from the display name.
 * Adds a short stamp so regenerates do not overwrite prior versions.
 */
const buildObjectFilename = (originalName, extension) => {
  const ext =
    extension ||
    path.posix.extname(String(originalName || '')).toLowerCase() ||
    '';
  const base = path.posix.basename(String(originalName || ''), ext);
  const stem =
    base
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'file';
  const stamp = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  return `${stem}_${stamp}${ext}`;
};

/**
 * Resolve an S3 object key from a stored Mongo value:
 * - https://bucket.s3.region.amazonaws.com/key
 * - https://bucket.s3.amazonaws.com/key
 * - https://s3.region.amazonaws.com/bucket/key
 * - /uploads/key (legacy)
 */
export const keyFromStoredPath = (storedPath) => {
  if (!storedPath || typeof storedPath !== 'string') return null;

  if (storedPath.startsWith(UPLOADS_PREFIX)) {
    const relative = storedPath.slice(UPLOADS_PREFIX.length);
    return isSafeRelativeKey(relative) ? relative : null;
  }

  let url;
  try {
    url = new URL(storedPath);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  const b = bucket().toLowerCase();
  const r = region().toLowerCase();
  let key = '';

  if (host === `${b}.s3.${r}.amazonaws.com` || host === `${b}.s3.amazonaws.com`) {
    key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } else if (
    host === `s3.${r}.amazonaws.com` ||
    host === 's3.amazonaws.com'
  ) {
    const parts = url.pathname.replace(/^\/+/, '').split('/');
    if (parts[0]?.toLowerCase() !== b) return null;
    key = decodeURIComponent(parts.slice(1).join('/'));
  } else {
    return null;
  }

  return isSafeRelativeKey(key) ? key : null;
};

/** True when the value is an HTTPS URL for our configured bucket. */
export const isOurS3ObjectUrl = (storedPath) =>
  Boolean(keyFromStoredPath(storedPath) && /^https?:\/\//i.test(storedPath));

const isNotFound = (error) => {
  const status = error?.$metadata?.httpStatusCode;
  const name = error?.name || error?.Code || '';
  return status === 404 || name === 'NoSuchKey' || name === 'NotFound';
};

const wrapStorageError = (error, fallbackMessage) => {
  if (error instanceof AppError) return error;
  if (isNotFound(error)) {
    return new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
  }
  logger.warn(
    `[storage:s3] ${fallbackMessage}: ${error?.name || 'Error'} ${error?.message || ''}`,
  );
  return new AppError(fallbackMessage, 503, { code: 'STORAGE_UNAVAILABLE' });
};

export const saveFile = async ({ buffer, mimetype, folder = '' }) => {
  const processed = await validateAndProcessImage(buffer, mimetype);
  const extension = EXTENSION_BY_MIME[processed.mimetype] || '';
  const filename = buildObjectFilename(`avatar${extension}`, extension);
  const key = `${folder ? `${folder}/` : ''}${filename}`;

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: processed.buffer,
        ContentType: processed.mimetype,
        ServerSideEncryption: 'AES256',
      }),
    );
  } catch (error) {
    throw wrapStorageError(error, 'Could not store file');
  }

  return {
    path: objectUrlForKey(key),
    mimetype: processed.mimetype,
  };
};

export const saveDocument = async ({
  buffer,
  mimetype,
  folder = 'documents',
  originalName = '',
}) => {
  const processed = await validateDocument(buffer, mimetype, originalName);
  const filename = buildObjectFilename(
    processed.originalName || `file${processed.extension}`,
    processed.extension,
  );
  const key = `${folder ? `${folder}/` : ''}${filename}`;

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: processed.buffer,
        ContentType: processed.mimetype,
        ServerSideEncryption: 'AES256',
      }),
    );
  } catch (error) {
    throw wrapStorageError(error, 'Could not store file');
  }

  return {
    path: objectUrlForKey(key),
    mimetype: processed.mimetype,
    originalName: processed.originalName,
    size: processed.buffer.length,
  };
};

export const deleteFile = async (publicPath) => {
  const key = keyFromStoredPath(publicPath);
  if (!key) return;

  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: bucket(),
        Key: key,
      }),
    );
  } catch (error) {
    if (isNotFound(error)) return;
    throw wrapStorageError(error, 'Could not delete file');
  }
};

export const readFileBuffer = async (publicPath) => {
  const key = keyFromStoredPath(publicPath);
  if (!key) {
    throw new AppError('File not found', 404, { code: 'FILE_NOT_FOUND' });
  }

  try {
    const response = await getClient().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
      }),
    );
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    throw wrapStorageError(error, 'Could not read file');
  }
};
