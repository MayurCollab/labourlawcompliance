/**
 * Operational application error.
 * Throw this anywhere (controller/service/repository); the global error
 * handler formats it into the standard error response shape:
 * { success: false, message, errors?: [], code? }
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} [statusCode=500] - HTTP status code.
   * @param {object} [options]
   * @param {Array<{field?: string, message: string}>} [options.errors] - Field-level errors.
   * @param {string} [options.code] - Machine-readable error code (e.g. 'VALIDATION_ERROR').
   * @param {boolean} [options.isOperational=true] - False for unexpected programmer errors.
   */
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    const { errors, code, isOperational = true } = options;

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
