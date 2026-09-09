import { getApiBaseUrl } from '@/utils/apiBaseUrl';

/**
 * Private S3 avatar URLs cannot be used as <img src>. Rewrite to the API
 * /uploads proxy using the object key (avatars/...).
 */
const s3UrlToUploadsProxyPath = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('.amazonaws.com')) return null;
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    // path-style: /bucket/avatars/x.png — keep last segments starting at avatars|generated
    const marker = key.match(/(?:^|\/)((?:avatars|generated)\/.+)$/i);
    const relative = marker?.[1] || (key.startsWith('avatars/') || key.startsWith('generated/') ? key : null);
    if (!relative) return null;
    return `/uploads/${relative}`;
  } catch {
    return null;
  }
};

/** Resolve a stored avatar path to an absolute URL for <img src>. */
export const resolveUploadUrl = (
  path: string | null | undefined,
): string | undefined => {
  if (!path) return undefined;

  let normalized = path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const proxied = s3UrlToUploadsProxyPath(path);
    if (!proxied) return path;
    normalized = proxied;
  }

  const base = getApiBaseUrl();
  const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return base ? `${base}${withSlash}` : withSlash;
};
