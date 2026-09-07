import { getApiBaseUrl } from '@/utils/apiBaseUrl';

/** Resolve a stored avatar path to an absolute URL for <img src>. */
export const resolveUploadUrl = (
  path: string | null | undefined,
): string | undefined => {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
};
