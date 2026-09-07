/** Name of the httpOnly cookie carrying the refresh token. */
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

/** Readable double-submit CSRF cookie (paired with X-CSRF-Token header). */
export const CSRF_COOKIE = 'csrfToken';

/** Header the SPA must echo with the CSRF cookie value. */
export const CSRF_HEADER = 'x-csrf-token';

/** Cookie is only sent to auth endpoints (refresh/logout). */
export const AUTH_COOKIE_PATH = '/api/v1/auth';

export const AUTH_CODES = Object.freeze({
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
});

export const AUTH_MESSAGES = Object.freeze({
  REGISTERED:
    'Registration successful. Please check your email to verify your account.',
  EMAIL_VERIFIED: 'Email verified successfully. You can now log in.',
  LOGGED_IN: 'Logged in successfully.',
  TOKEN_REFRESHED: 'Token refreshed successfully.',
  LOGGED_OUT: 'Logged out successfully.',
  LOGGED_OUT_EVERYWHERE: 'Logged out of all sessions successfully.',
  SESSIONS_FETCHED: 'Active sessions fetched successfully.',
  SESSION_REVOKED: 'Session revoked successfully.',
  FORGOT_PASSWORD:
    'If an account exists for that email, a password reset link has been sent.',
  PASSWORD_RESET: 'Password reset successfully. Please log in again.',
  PASSWORD_CHANGED: 'Password changed successfully.',
});
