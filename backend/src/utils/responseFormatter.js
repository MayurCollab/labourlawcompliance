/**
 * Shared response formatter.
 * Every controller MUST use these helpers (or throw an AppError) so that
 * all API responses have a consistent shape:
 *   success: { success: true, message, data }
 *   error:   { success: false, message, errors?, code? }
 */

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });

export const sendError = (
  res,
  message = 'Something went wrong',
  statusCode = 500,
  errors = undefined,
  code = undefined,
) => {
  const body = { success: false, message };
  if (Array.isArray(errors) && errors.length > 0) {
    body.errors = errors;
  }
  if (code) {
    body.code = code;
  }
  return res.status(statusCode).json(body);
};
