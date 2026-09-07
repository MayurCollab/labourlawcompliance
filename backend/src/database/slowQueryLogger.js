import config from '../config/index.js';
import { mongoSlowQueriesTotal } from '../observability/metrics.js';
import logger from '../utils/logger.js';
import { getRequestContext } from '../utils/requestContext.js';

/** Driver chatter that would otherwise drown out real query timings. */
const IGNORED_COMMANDS = new Set([
  'hello',
  'ismaster',
  'ping',
  'buildInfo',
  'getParameter',
  'endSessions',
  'saslStart',
  'saslContinue',
  'authenticate',
  'createIndexes',
  'listIndexes',
]);

/** Commands whose first field names the target collection. */
const COLLECTION_FIELD = {
  find: 'find',
  aggregate: 'aggregate',
  count: 'count',
  distinct: 'distinct',
  insert: 'insert',
  update: 'update',
  delete: 'delete',
  findAndModify: 'findAndModify',
};

/**
 * Logs any MongoDB command slower than DB_SLOW_QUERY_MS.
 *
 * Uses driver command monitoring rather than Mongoose middleware because it
 * measures what the server actually took (including a slow aggregate or an
 * unindexed sort) and covers every code path — including aggregations, which
 * Mongoose query middleware does not wrap.
 */
export const attachSlowQueryLogger = (connection) => {
  const thresholdMs = config.db.slowQueryMs;

  if (!thresholdMs || thresholdMs <= 0) {
    logger.info('[db] Slow-query logging disabled (DB_SLOW_QUERY_MS=0)');
    return;
  }

  /** requestId -> details captured while still inside the caller's async context */
  const inFlight = new Map();

  connection.on('commandStarted', (event) => {
    if (IGNORED_COMMANDS.has(event.commandName)) return;

    const collectionKey = COLLECTION_FIELD[event.commandName];
    const ctx = getRequestContext();

    inFlight.set(event.requestId, {
      commandName: event.commandName,
      collection: collectionKey ? event.command[collectionKey] : undefined,
      filter: event.command.filter || event.command.query,
      sort: event.command.sort,
      requestId: ctx?.requestId,
      route: ctx?.route || ctx?.path,
      userId: ctx?.userId,
    });

    // Bound the map if a command never reports completion
    if (inFlight.size > 1000) {
      inFlight.delete(inFlight.keys().next().value);
    }
  });

  const complete = (event, outcome) => {
    const started = inFlight.get(event.requestId);
    inFlight.delete(event.requestId);

    if (!started || event.duration < thresholdMs) return;

    const collection = started.collection || 'unknown';

    mongoSlowQueriesTotal.inc({
      collection,
      operation: started.commandName,
    });

    logger.warn(
      `[slow-query] ${started.commandName} on ${collection} took ${event.duration}ms`,
      {
        durationMs: event.duration,
        thresholdMs,
        collection,
        operation: started.commandName,
        outcome,
        filter: started.filter ? Object.keys(started.filter) : undefined,
        sort: started.sort ? Object.keys(started.sort) : undefined,
        // Re-attached explicitly: driver callbacks do not reliably run inside
        // the request's AsyncLocalStorage context
        requestId: started.requestId,
        route: started.route,
        userId: started.userId,
      },
    );
  };

  connection.on('commandSucceeded', (event) => complete(event, 'succeeded'));
  connection.on('commandFailed', (event) => complete(event, 'failed'));

  logger.info(`[db] Slow-query logging enabled (>${thresholdMs}ms)`);
};

export default attachSlowQueryLogger;
