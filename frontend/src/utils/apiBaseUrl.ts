/**
 * Resolve API / upload base URL.
 *
 * In the Vite browser during development, prefer same-origin (`''`) so
 * `/api` and `/uploads` go through the Vite proxy. That keeps LAN access
 * (`http(s)://192.168.x.x:5190`) working without CORS or localhost-only
 * API URLs that break on another device.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return '';
  }

  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    // Production SPA is usually same-origin (nginx proxies /api).
    return import.meta.env.PROD ? '' : 'http://localhost:5000';
  }
  return String(raw).replace(/\/$/, '');
}
