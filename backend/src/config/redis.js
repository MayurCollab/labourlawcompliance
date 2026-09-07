import Redis from 'ioredis';

import config from './index.js';
import logger from '../utils/logger.js';

/** @type {import('ioredis').default | null} */
let redisClient = null;

/**
 * Shared Redis client for rate-limit store + BullMQ.
 * Returns null when REDIS_URL is unset (dev/test fallback).
 */
export const getRedis = () => {
  if (!config.redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      logger.error(`[redis] ${err.message}`);
    });
  }

  return redisClient;
};

export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

export const isRedisEnabled = () => Boolean(config.redisUrl);
