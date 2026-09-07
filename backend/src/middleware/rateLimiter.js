import { RedisStore } from 'rate-limit-redis';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { getRedis, isRedisEnabled } from '../config/redis.js';
import config from '../config/index.js';
import { sendError } from '../utils/responseFormatter.js';

const rateLimitHandler = (_req, res) =>
  sendError(
    res,
    'Too many requests, please try again later.',
    429,
    undefined,
    'RATE_LIMIT_EXCEEDED',
  );

const buildStore = (prefix) => {
  if (!isRedisEnabled()) return undefined;
  const client = getRedis();
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args) => client.call(...args),
  });
};

/**
 * Global IP limiter — Redis-backed when REDIS_URL is set, otherwise memory
 * (single-instance / local-dev fallback).
 */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  store: buildStore('global'),
  handler: rateLimitHandler,
});

/** Stricter limiter for login/register/forgot-password (failures only). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => config.isTest,
  store: buildStore('auth'),
  handler: rateLimitHandler,
});

/**
 * Authenticated write limiter keyed by user id (falls back to IP).
 * Apply after `authenticate` on mutating admin/profile routes.
 */
export const userWriteLimiter = rateLimit({
  windowMs: Number(process.env.USER_WRITE_RATE_WINDOW) || 15 * 60 * 1000,
  max: Number(process.env.USER_WRITE_RATE_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.isTest || req.method === 'GET' || req.method === 'HEAD',
  keyGenerator: (req) =>
    req.user?.id
      ? `user:${req.user.id}`
      : `ip:${ipKeyGenerator(req.ip)}`,
  store: buildStore('user-write'),
  handler: rateLimitHandler,
});
