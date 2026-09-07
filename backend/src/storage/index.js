import config from '../config/index.js';
import * as localStorage from './local.storage.js';
import * as s3Storage from './s3.storage.js';

/**
 * Storage abstraction — services import this module, never a provider
 * directly. Drivers share saveFile/saveDocument/readFileBuffer/deleteFile
 * and store the same public path shape (/uploads/...).
 */
const providers = {
  local: localStorage,
  s3: s3Storage,
};

const storage = providers[config.storage.driver];

if (!storage) {
  throw new Error(
    `[storage] Unknown storage driver '${config.storage.driver}'. Available: ${Object.keys(providers).join(', ')}`,
  );
}

export default storage;
