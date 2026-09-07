const CSRF_STORAGE_KEY = 'blueprint_csrf';

/** Persist CSRF token from login/refresh responses (cross-origin safe). */
export const setCsrfToken = (token: string | null | undefined) => {
  if (typeof sessionStorage === 'undefined') return;
  if (!token) {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(CSRF_STORAGE_KEY, token);
};

export const getStoredCsrfToken = (): string | null => {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(CSRF_STORAGE_KEY);
};

export const clearCsrfToken = () => setCsrfToken(null);
