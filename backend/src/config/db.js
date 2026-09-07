import mongoose from 'mongoose';

import { attachSlowQueryLogger } from '../database/slowQueryLogger.js';
import { resetTransactionSupportCache } from '../database/withTransaction.js';
import logger from '../utils/logger.js';
import config from './index.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mongoose.connection.on('connected', () => {
  logger.info('[db] MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('[db] MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`[db] MongoDB connection error: ${err.message}`);
});

/**
 * Connect to MongoDB with retry-on-failure.
 * Retries up to MAX_RETRIES times with a fixed delay, then rethrows
 * so the caller (server.js) can exit with a non-zero code.
 */
export const connectDB = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      // monitorCommands powers the slow-query logger below
      await mongoose.connect(config.mongoUri, { monitorCommands: true });
      resetTransactionSupportCache();
      attachSlowQueryLogger(mongoose.connection);
      return;
    } catch (err) {
      logger.warn(
        `[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`,
      );
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Could not connect to MongoDB after ${MAX_RETRIES} attempts: ${err.message}`,
        );
      }
      await delay(RETRY_DELAY_MS);
    }
  }
};

/** Close the Mongoose connection (used during graceful shutdown). */
export const disconnectDB = async () => {
  await mongoose.connection.close();
};
