import mongoSanitize from 'express-mongo-sanitize';

import logger from '../utils/logger.js';

/**
 * Strip Mongo operator keys ($ne, $gt, …) from body/params/query.
 * Express 5 makes `req.query` a getter — re-define it after sanitizing.
 */
const mongoSanitizeMiddleware = (req, _res, next) => {
  const onSanitize = ({ key }) => {
    logger.warn(
      `[security] Removed potential NoSQL operator from request (${key})`,
    );
  };

  if (req.body && typeof req.body === 'object') {
    mongoSanitize.sanitize(req.body, { replaceWith: '_', onSanitize });
  }

  if (req.params && typeof req.params === 'object') {
    mongoSanitize.sanitize(req.params, { replaceWith: '_', onSanitize });
  }

  if (req.query && typeof req.query === 'object') {
    const cleaned = mongoSanitize.sanitize(
      JSON.parse(JSON.stringify(req.query)),
      { replaceWith: '_', onSanitize },
    );
    Object.defineProperty(req, 'query', {
      value: cleaned,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  next();
};

export default mongoSanitizeMiddleware;
