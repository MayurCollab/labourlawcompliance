import logger from '../utils/logger.js';
import { getRouteLabel } from '../utils/routeLabel.js';
import { setRequestContext } from '../utils/requestContext.js';

/**
 * One structured log line per request, emitted on response finish so the
 * status code, matched route and duration are all known.
 *
 * Replaces morgan: morgan formats a string, which loses the structured
 * fields (requestId / userId / route) that make logs searchable.
 */
const httpLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = getRouteLabel(req);

    // Make the matched route available to the correlation format too
    setRequestContext({ route });

    const meta = {
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      ip: req.ip,
      contentLength: Number(res.getHeader('content-length')) || 0,
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode}`;

    if (res.statusCode >= 500) {
      logger.error(message, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(message, meta);
    } else {
      logger.http(message, meta);
    }
  });

  next();
};

export default httpLogger;
