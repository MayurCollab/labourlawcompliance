import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

const getSnapshot = () => navigator.onLine;

// SSR/pre-hydration has no navigator; assume online so nothing flashes
const getServerSnapshot = () => true;

/**
 * Tracks browser connectivity.
 *
 * `navigator.onLine` only reports whether the machine has *a* network, not
 * whether the API is reachable — a captive portal or a dead backend both read
 * as "online". The offline banner pairs this with actual request failures.
 */
export const useOnlineStatus = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
