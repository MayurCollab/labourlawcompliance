import config from '../config/index.js';
import * as localStorage from './local.storage.js';
import * as hybridStorage from './hybrid.storage.js';
import * as s3Storage from './s3.storage.js';

/**
 * Storage abstraction — services import this module, never a provider
 * directly. Drivers share saveFile/saveDocument/readFileBuffer/deleteFile
 * Local disk uses /uploads/... paths. S3 objects store a full HTTPS
 * bucket URL in MongoDB (still private — download via the API).
 *
 * `s3` (app default): documents/, generated/, avatars/ go to the bucket;
 * templates/ stay on local disk so Form 5 layouts are unchanged.
 * `local` is for automated tests only.
 */
const providers = {
  local: localStorage,
  s3: hybridStorage,
  /** Put templates in the bucket too. Prefer `s3` so Form 5 templates stay local. */
  's3-all': s3Storage,
};

const storage = providers[config.storage.driver];

if (!storage) {
  throw new Error(
    `[storage] Unknown storage driver '${config.storage.driver}'. Available: ${Object.keys(providers).join(', ')}`,
  );
}

export default storage;
