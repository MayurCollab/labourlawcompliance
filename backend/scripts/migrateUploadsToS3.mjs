/**
 * Copy existing Excel / PDF / images from backend/uploads to S3 and rewrite
 * Mongo storedPath values to the bucket URL.
 *
 * Skips uploads/templates entirely — bundled and uploaded Form 5 templates
 * stay on disk.
 *
 * Usage:
 *   npm run migrate:uploads-s3
 *   npm run migrate:uploads-s3 -- --dry-run
 *   npm run migrate:uploads-s3 -- --delete-local
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import mongoose from 'mongoose';

import config from '../src/config/index.js';
import { objectUrlForKey } from '../src/storage/s3.storage.js';

export const MIGRATE_FOLDERS = Object.freeze([
  'avatars',
  'documents',
  'generated',
]);
export const SKIP_FOLDERS = Object.freeze(['templates']);

const CONTENT_TYPE_BY_EXT = {
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xls': 'application/vnd.ms-excel',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

export const contentTypeForName = (filename) =>
  CONTENT_TYPE_BY_EXT[path.extname(String(filename || '')).toLowerCase()] ||
  'application/octet-stream';

export const shouldMigrateRelative = (relative) => {
  const folder = String(relative || '')
    .replace(/\\/g, '/')
    .split('/')[0];
  if (SKIP_FOLDERS.includes(folder)) return false;
  return MIGRATE_FOLDERS.includes(folder);
};

export const storedPathForRelative = (relative) =>
  `/uploads/${String(relative).replace(/\\/g, '/')}`;

const listFilesRecursive = async (directory, prefix = '') => {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolute, relative)));
    } else if (entry.isFile()) {
      files.push({ relative: relative.replace(/\\/g, '/'), absolute });
    }
  }
  return files;
};

export const listMigratableUploads = async (root = UPLOADS_ROOT) => {
  const all = await listFilesRecursive(root);
  return all.filter((file) => shouldMigrateRelative(file.relative));
};

const objectExists = async (client, bucket, key) => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const name = error?.name || error?.Code || '';
    if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
};

const rewriteMongoPaths = async (db, replacements) => {
  if (!replacements.size) {
    return { uploads: 0, filings: 0, users: 0 };
  }

  const fromPaths = [...replacements.keys()];
  let uploads = 0;
  let filings = 0;
  let users = 0;

  const uploadDocs = await db
    .collection('uploads')
    .find({ storedPath: { $in: fromPaths } })
    .project({ storedPath: 1 })
    .toArray();

  for (const doc of uploadDocs) {
    const next = replacements.get(doc.storedPath);
    if (!next) continue;
    const result = await db
      .collection('uploads')
      .updateOne({ _id: doc._id }, { $set: { storedPath: next } });
    uploads += result.modifiedCount;
  }

  const filingDocs = await db
    .collection('filings')
    .find({
      $or: [
        { 'generatedFile.storedPath': { $in: fromPaths } },
        { 'generatedHistory.storedPath': { $in: fromPaths } },
      ],
    })
    .project({ generatedFile: 1, generatedHistory: 1 })
    .toArray();

  for (const doc of filingDocs) {
    const set = {};
    const current = doc.generatedFile?.storedPath;
    if (current && replacements.has(current)) {
      set['generatedFile.storedPath'] = replacements.get(current);
    }

    const history = Array.isArray(doc.generatedHistory)
      ? doc.generatedHistory.map((item) => {
          const pathValue = item?.storedPath;
          if (!pathValue || !replacements.has(pathValue)) return item;
          return { ...item, storedPath: replacements.get(pathValue) };
        })
      : null;

    if (history) set.generatedHistory = history;
    if (!Object.keys(set).length) continue;

    const result = await db
      .collection('filings')
      .updateOne({ _id: doc._id }, { $set: set });
    filings += result.modifiedCount;
  }

  const userDocs = await db
    .collection('users')
    .find({ avatar: { $in: fromPaths } })
    .project({ avatar: 1 })
    .toArray();

  for (const doc of userDocs) {
    const next = replacements.get(doc.avatar);
    if (!next) continue;
    const result = await db
      .collection('users')
      .updateOne({ _id: doc._id }, { $set: { avatar: next } });
    users += result.modifiedCount;
  }

  return { uploads, filings, users };
};

const parseArgs = (argv) => ({
  dryRun: argv.includes('--dry-run'),
  deleteLocal: argv.includes('--delete-local'),
});

export const migrateUploadsToS3 = async ({
  dryRun = false,
  deleteLocal = false,
  log = console,
} = {}) => {
  const { region, bucket, accessKeyId, secretAccessKey } = config.storage.s3;
  if (!bucket || !accessKeyId || !secretAccessKey || !region) {
    throw new Error(
      'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_BUCKET_NAME in backend/.env',
    );
  }

  const files = await listMigratableUploads();
  log.log(
    `Found ${files.length} file(s) to migrate (skipped: ${SKIP_FOLDERS.join(', ')}).`,
  );

  if (!files.length) {
    return { uploaded: 0, existed: 0, failed: 0, mongo: { uploads: 0, filings: 0, users: 0 }, deleted: 0 };
  }

  if (dryRun) {
    for (const file of files) {
      log.log(`dry-run  ${file.relative}  ->  ${objectUrlForKey(file.relative)}`);
    }
    log.log('Dry run only — nothing uploaded, Mongo unchanged, templates untouched.');
    return {
      uploaded: 0,
      existed: 0,
      failed: 0,
      mongo: { uploads: 0, filings: 0, users: 0 },
      deleted: 0,
    };
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const replacements = new Map();
  let uploaded = 0;
  let existed = 0;
  let failed = 0;
  const uploadedAbsolutes = [];

  for (const file of files) {
    const key = file.relative;
    const url = objectUrlForKey(key);
    try {
      const already = await objectExists(client, bucket, key);
      if (!already) {
        const body = await fs.readFile(file.absolute);
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentTypeForName(file.relative),
            ServerSideEncryption: 'AES256',
          }),
        );
        uploaded += 1;
        log.log(`uploaded  ${key}`);
      } else {
        existed += 1;
        log.log(`exists    ${key}`);
      }
      replacements.set(storedPathForRelative(key), url);
      uploadedAbsolutes.push(file.absolute);
    } catch (error) {
      failed += 1;
      log.error(`failed    ${key}: ${error.message}`);
    }
  }

  await mongoose.connect(config.mongoUri);
  let mongo = { uploads: 0, filings: 0, users: 0 };
  try {
    mongo = await rewriteMongoPaths(mongoose.connection.db, replacements);
  } finally {
    await mongoose.disconnect();
  }

  let deleted = 0;
  if (deleteLocal) {
    for (const absolute of uploadedAbsolutes) {
      await fs.rm(absolute, { force: true });
      deleted += 1;
    }
    log.log(`Deleted ${deleted} local file(s). templates/ was not touched.`);
  }

  log.log(
    `Done. uploaded=${uploaded} alreadyInBucket=${existed} failed=${failed} mongoUploads=${mongo.uploads} mongoFilings=${mongo.filings} mongoUsers=${mongo.users}`,
  );
  log.log('Form 5 templates (uploads/templates and bundled HTML) were left as-is.');

  return { uploaded, existed, failed, mongo, deleted };
};

const isDirectRun = () => {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.resolve(invoked) === fileURLToPath(import.meta.url);
};

if (isDirectRun()) {
  const { dryRun, deleteLocal } = parseArgs(process.argv.slice(2));
  try {
    const result = await migrateUploadsToS3({ dryRun, deleteLocal });
    if (result.failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
