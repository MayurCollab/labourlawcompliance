/** Resolve API / upload base URL (defaults to local backend). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    // Production SPA is usually same-origin (nginx proxies /api). Localhost
    // as a default would make the visitor's browser call their own machine.
    return import.meta.env.PROD ? '' : 'http://localhost:5000';
  }
  return String(raw).replace(/\/$/, '');
}
