import mongoose from 'mongoose';

import logger from '../utils/logger.js';

/**
 * MongoDB only supports multi-document transactions on a replica set or a
 * sharded cluster. A plain single-node `mongod` (the usual local dev setup,
 * and what mongodb-memory-server starts by default) rejects them.
 *
 * Rather than making every developer run a replica set, transactional writes
 * degrade to sequential writes when the deployment can't support them — with
 * a loud warning, because that path is not atomic.
 *
 * null = not probed yet.
 * @type {boolean | null}
 */
let transactionsSupported = null;

export const resetTransactionSupportCache = () => {
  transactionsSupported = null;
};

const probeTransactionSupport = async () => {
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    // `setName` => replica set member, `isdbgrid` => mongos
    return Boolean(info.setName) || info.msg === 'isdbgrid';
  } catch (err) {
    logger.warn(`[db] Could not probe transaction support: ${err.message}`);
    return false;
  }
};

export const supportsTransactions = async () => {
  if (transactionsSupported === null) {
    transactionsSupported = await probeTransactionSupport();

    if (!transactionsSupported) {
      logger.warn(
        '[db] Standalone MongoDB detected — multi-document writes will run ' +
          'WITHOUT transactions. Use a replica set in production.',
      );
    }
  }

  return transactionsSupported;
};

/**
 * Runs `fn(session)` inside a transaction when the deployment supports one.
 *
 * The callback must pass the session through to every write it performs
 * (`doc.save({ session })`, `Model.updateMany(filter, update, { session })`),
 * and must tolerate `session` being null on standalone deployments.
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession | null) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withTransaction = async (fn) => {
  if (!(await supportsTransactions())) {
    return fn(null);
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export default withTransaction;
