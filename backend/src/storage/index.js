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
 * `s3` uses hybrid routing: only avatars/ and generated/ go to the bucket;
 * documents/ and templates/ stay on local disk.
 */
const providers = {
  local: localStorage,
  s3: hybridStorage,
  /** Full-bucket mode (tests / future). Prefer `s3` for selective folders. */
  's3-all': s3Storage,
};

const storage = providers[config.storage.driver];

if (!storage) {
  throw new Error(
    `[storage] Unknown storage driver '${config.storage.driver}'. Available: ${Object.keys(providers).join(', ')}`,
  );
}

export default storage;
