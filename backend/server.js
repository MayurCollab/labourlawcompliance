// Must stay first: Sentry has to patch http/express/mongoose before they load
import './src/observability/instrument.js';

import config from './src/config/index.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import {
  connectRedis,
  disconnectRedis,
  isRedisEnabled,
} from './src/config/redis.js';
import {
  startEmailWorker,
  stopEmailWorker,
} from './src/email/emailQueue.js';
import logger from './src/utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const start = async () => {
  await connectDB();
  await connectRedis();

  // Load Express after Redis probe so rate-limit stores match availability.
  const { default: app } = await import('./src/app.js');

  if (isRedisEnabled()) {
    startEmailWorker();
  } else {
    logger.warn(
      '[startup] Redis unavailable — using in-memory rate limits and inline email sends',
    );
  }

  const server = app.listen(config.port, () => {
    const storageNote =
      config.storage.driver === 's3'
        ? `s3 bucket ${config.storage.s3.bucket}`
        : 'local disk';
    logger.info(
      `Backend listening on port ${config.port} (${config.env}) — storage: ${storageNote} — docs at /api-docs`,
    );
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);

    server.close(async () => {
      try {
        await stopEmailWorker();
        await disconnectRedis();
        await disconnectDB();
        logger.info('HTTP server, workers, and MongoDB closed. Bye.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during shutdown: ${err.message}`);
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown: connections did not close in time');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason}`);
    throw reason instanceof Error ? reason : new Error(String(reason));
  });

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.stack || err.message}`);
    shutdown('uncaughtException');
  });
};

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
