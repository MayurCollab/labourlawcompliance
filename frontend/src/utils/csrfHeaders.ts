import { CSRF_HEADER, getCookie, CSRF_COOKIE } from '@/utils/cookies';
import { getStoredCsrfToken } from '@/utils/csrf';

/** Prefer in-memory/session token; fall back to readable cookie (same-origin). */
export const getCsrfHeaders = (): Record<string, string> => {
  const token = getStoredCsrfToken() || getCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
};
