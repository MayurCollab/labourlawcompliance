import mongoose from 'mongoose';

import config from '../config/index.js';
import { getRedis, isRedisEnabled } from '../config/redis.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { sendSuccess } from '../utils/responseFormatter.js';

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const PING_TIMEOUT_MS = 2000;

/** Rejects instead of hanging when a dependency stops answering. */
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error(`${label} check timed out after ${ms}ms`)),
        ms,
      ).unref?.(),
    ),
  ]);

const checkMongo = async () => {
  if (mongoose.connection.readyState !== 1) {
    return {
      status: 'down',
      state: DB_STATES[mongoose.connection.readyState] || 'unknown',
    };
  }

  const startedAt = Date.now();
  try {
    await withTimeout(
      mongoose.connection.db.admin().ping(),
      PING_TIMEOUT_MS,
      'mongo',
    );
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { status: 'down', error: err.message };
  }
};

const checkRedis = async () => {
  if (!isRedisEnabled()) {
    // Not configured is a valid deployment (dev/single instance), not a failure
    return { status: 'not_configured' };
  }

  const startedAt = Date.now();
  try {
    await withTimeout(getRedis().ping(), PING_TIMEOUT_MS, 'redis');
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { status: 'down', error: err.message };
  }
};

/**
 * GET /api/v1/health/live
 * Liveness: is this process running and able to answer? Never touches a
 * dependency — a failing dependency must not make an orchestrator kill and
 * restart an otherwise-healthy process.
 */
export const getLiveness = asyncHandler(async (_req, res) =>
  sendSuccess(
    res,
    {
      status: 'alive',
      environment: config.env,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    },
    'OK',
  ),
);

/**
 * GET /api/v1/health/ready
 * Readiness: can this process actually serve traffic? Pings Mongo (and Redis
 * when configured). Returns 503 when any required dependency is down so a
 * load balancer takes the instance out of rotation without restarting it.
 */
export const getReadiness = asyncHandler(async (_req, res) => {
  const [database, redis] = await Promise.all([checkMongo(), checkRedis()]);

  const ready = database.status === 'up' && redis.status !== 'down';
  const body = {
    success: ready,
    message: ready ? 'READY' : 'NOT_READY',
    data: {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    },
  };

  return res.status(ready ? 200 : 503).json(body);
});

/**
 * GET /api/v1/health
 * Back-compat summary endpoint. Kept because existing probes point at it;
 * new deployments should use /health/live and /health/ready.
 */
export const getHealth = asyncHandler(async (_req, res) =>
  sendSuccess(
    res,
    {
      status: 'healthy',
      environment: config.env,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      database: DB_STATES[mongoose.connection.readyState] || 'unknown',
    },
    'OK',
  ),
);
