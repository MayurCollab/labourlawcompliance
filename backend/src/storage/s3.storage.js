import { randomUUID } from 'node:crypto';

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
 * Objects stay private; avatars are streamed through /uploads, documents
 * through authenticated module download endpoints.
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

const publicPathFor = (folder, filename) =>
  `${UPLOADS_PREFIX}${folder ? `${folder}/` : ''}${filename}`;

const keyFromPublicPath = (publicPath) => {
  if (!publicPath || !publicPath.startsWith(UPLOADS_PREFIX)) return null;

  const relative = publicPath.slice(UPLOADS_PREFIX.length);
  if (
    !relative ||
    relative.includes('\0') ||
    relative.includes('..') ||
    relative.includes('\\')
  ) {
    return null;
  }

  return relative;
};

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
  const filename = `${randomUUID()}${extension}`;
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
    path: publicPathFor(folder, filename),
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
  const filename = `${randomUUID()}${processed.extension}`;
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
    path: publicPathFor(folder, filename),
    mimetype: processed.mimetype,
    originalName: processed.originalName,
    size: processed.buffer.length,
  };
};

export const deleteFile = async (publicPath) => {
  const key = keyFromPublicPath(publicPath);
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
  const key = keyFromPublicPath(publicPath);
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
