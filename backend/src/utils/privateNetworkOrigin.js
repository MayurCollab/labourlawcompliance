/**
 * True when the Origin is a loopback or RFC1918 private host — used so Vite's
 * Network URL (e.g. https://192.168.1.114:5190) works in local development
 * without listing every LAN IP in CLIENT_URL.
 */
export const isPrivateNetworkOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
      return true;
    }
    // IPv4 private ranges
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    const m = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (m) {
      const second = Number(m[1]);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
};
