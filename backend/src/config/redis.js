import Redis from 'ioredis';

import config from './index.js';
import logger from '../utils/logger.js';

/** @type {import('ioredis').default | null} */
let redisClient = null;

const CONNECT_TIMEOUT_MS = 2_000;
const ERROR_LOG_INTERVAL_MS = 30_000;

let lastErrorLogAt = 0;

const logRedisError = (err) => {
  const now = Date.now();
  if (now - lastErrorLogAt < ERROR_LOG_INTERVAL_MS) return;
  lastErrorLogAt = now;
  logger.error(`[redis] ${err.message}`);
};

/**
 * Shared Redis client for rate-limit store + BullMQ.
 * Returns null when REDIS_URL is unset or Redis is unreachable.
 */
export const getRedis = () => redisClient;

export const isRedisEnabled = () => Boolean(redisClient);

/**
 * Probe REDIS_URL once at boot. If nothing is listening, disable Redis and
 * keep serving with in-memory rate limits + inline email — do not retry forever.
 */
export const connectRedis = async () => {
  if (!config.redisUrl || redisClient) {
    return redisClient;
  }

  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: CONNECT_TIMEOUT_MS,
    retryStrategy: () => (redisClient ? 2_000 : null),
  });

  try {
    await client.connect();
    await client.ping();
    redisClient = client;
    client.on('error', logRedisError);
    logger.info('[redis] connected');
    return redisClient;
  } catch (err) {
    logger.warn(
      `[redis] ${err.message} — using in-memory rate limits and inline email sends`,
    );
    client.disconnect(false);
    redisClient = null;
    return null;
  }
};

export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
