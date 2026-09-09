import * as localStorage from './local.storage.js';
import * as s3Storage from './s3.storage.js';

/**
 * Selective S3 routing — only these folders go to the bucket; everything
 * else (documents, templates, …) stays on local disk.
 */
export const S3_FOLDERS = Object.freeze(['avatars', 'generated']);

const S3_FOLDER_SET = new Set(S3_FOLDERS);

const normalizeFolder = (folder) =>
  String(folder || '')
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0];

const usesS3Folder = (folder) => S3_FOLDER_SET.has(normalizeFolder(folder));

const usesS3Path = (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return false;
  return usesS3Folder(publicPath.slice('/uploads/'.length));
};

const providerForFolder = (folder) =>
  usesS3Folder(folder) ? s3Storage : localStorage;

const providerForPath = (publicPath) =>
  usesS3Path(publicPath) ? s3Storage : localStorage;

export const saveFile = (args) => providerForFolder(args?.folder).saveFile(args);

export const saveDocument = (args) =>
  providerForFolder(args?.folder ?? 'documents').saveDocument(args);

export const deleteFile = (publicPath) =>
  providerForPath(publicPath).deleteFile(publicPath);

export const readFileBuffer = (publicPath) =>
  providerForPath(publicPath).readFileBuffer(publicPath);
