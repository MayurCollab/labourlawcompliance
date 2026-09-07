import { randomBytes } from 'node:crypto';

import config from '../config/index.js';
import AppError from '../utils/AppError.js';
import { CSRF_COOKIE, CSRF_HEADER } from '../modules/auth/auth.constants.js';

/**
 * CSRF cookie is path=/ so the SPA can read it via document.cookie.
 * The refresh token cookie stays scoped to /api/v1/auth (httpOnly).
 */
const csrfCookieOptions = () => ({
  httpOnly: false, // double-submit: JS must read and echo as a header
  secure: config.isProduction,
  sameSite: 'strict',
  path: '/',
});

/** Set a fresh CSRF cookie (call whenever the refresh cookie is set). */
export const setCsrfCookie = (res) => {
  const token = randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  return token;
};

export const clearCsrfCookie = (res) => {
  res.clearCookie(CSRF_COOKIE, csrfCookieOptions());
};

/**
 * Double-submit CSRF check for cookie-authenticated auth routes
 * (refresh-token / logout). Bearer-only routes do not need this.
 */
export const requireCsrf = (req, _res, next) => {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length < 32 ||
    cookieToken !== headerToken
  ) {
    return next(
      new AppError('CSRF validation failed', 403, { code: 'CSRF_INVALID' }),
    );
  }

  return next();
};
