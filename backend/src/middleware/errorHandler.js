import config from '../config/index.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { sendError } from '../utils/responseFormatter.js';

/**
 * 404 handler — converts unknown routes into an AppError so they flow
 * through the same global error handler as everything else.
 */
export const notFound = (req, _res, next) => {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, {
      code: 'ROUTE_NOT_FOUND',
    }),
  );
};

/** Translate well-known third-party errors into operational AppErrors. */
const normalizeError = (err) => {
  if (err instanceof AppError) {
    return err;
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new AppError('Validation failed', 422, {
      errors,
      code: 'VALIDATION_ERROR',
    });
  }

  // Mongoose: malformed ObjectId etc. — keep path out of the client message
  if (err.name === 'CastError') {
    return new AppError('Invalid identifier or field value', 400, {
      code: 'INVALID_INPUT',
    });
  }

  // MongoDB: duplicate unique key — never echo raw keyValue to clients
  if (err.code === 11000) {
    return new AppError('A record with that value already exists', 409, {
      code: 'DUPLICATE_KEY',
    });
  }

  // body-parser: malformed JSON payload
  if (err.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON in request body', 400, {
      code: 'INVALID_JSON',
    });
  }

  // Multer: upload errors (file too large, unexpected field, ...)
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large'
        : `Upload error: ${err.message}`;
    return new AppError(message, 422, { code: 'UPLOAD_ERROR' });
  }

  // JWT errors (thrown by jsonwebtoken in later phases)
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, { code: 'INVALID_TOKEN' });
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401, { code: 'TOKEN_EXPIRED' });
  }

  // Anything else is an unexpected programmer error
  return new AppError(err.message || 'Internal server error', 500, {
    isOperational: false,
  });
};

/**
 * Global error handler — MUST be registered last in app.js.
 * Formats every error into: { success: false, message, errors?, code? }
 */
export const errorHandler = (err, req, res, _next) => {
  const error = normalizeError(err);

  if (error.statusCode >= 500) {
    logger.error(
      `${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}\n${err.stack}`,
    );
  } else {
    logger.warn(
      `${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}`,
    );
  }

  // Never leak internals of unexpected errors in production.
  // Validation field details stay (operational); strip unexpected messages.
  let message = error.message;
  let errors = error.errors;

  if (config.isProduction && !error.isOperational) {
    message = 'Internal server error';
    errors = undefined;
  }

  return sendError(res, message, error.statusCode, errors, error.code);
};
