import config from '../../config/index.js';
import { clearCsrfCookie, setCsrfCookie } from '../../middleware/csrf.js';
import { AUTH_COOKIE_PATH, REFRESH_TOKEN_COOKIE } from './auth.constants.js';

/**
 * Session cookie helpers, extracted from the auth controller so other modules
 * that end a session (account erasure, for one) clear exactly the same
 * cookies with exactly the same attributes — a mismatch on path or sameSite
 * silently leaves the cookie in the browser.
 */
export const refreshCookieOptions = (expires) => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  path: AUTH_COOKIE_PATH,
  expires,
});

export const setSessionCookies = (res, refreshToken, expiresAt) => {
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    refreshCookieOptions(expiresAt),
  );
  // Also returned in JSON — cross-origin SPAs cannot read the CSRF cookie
  return setCsrfCookie(res);
};

export const clearSessionCookies = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions());
  clearCsrfCookie(res);
};
