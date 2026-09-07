/** Read a cookie value from document.cookie (non-httpOnly cookies only). */
export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=').slice(1).join('='));
};

export const CSRF_COOKIE = 'csrfToken';
export const CSRF_HEADER = 'X-CSRF-Token';
