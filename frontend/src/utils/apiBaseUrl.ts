/** Resolve API / upload base URL (defaults to local backend). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === null) {
    return 'http://localhost:5000';
  }
  return String(raw).replace(/\/$/, '');
}
