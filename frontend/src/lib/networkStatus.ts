/**
 * Tracks whether the API is actually reachable.
 *
 * `navigator.onLine` is not enough: a captive portal, a dropped VPN or a
 * backend that stopped answering all read as "online". This store is fed by
 * the axios interceptor — a request that fails with no response at all means
 * the API is unreachable; any response (even a 500) means it isn't.
 *
 * A plain external store rather than context so the axios layer can report
 * into it without importing React.
 */
let apiReachable = true;

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeToApiReachability = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getApiReachable = () => apiReachable;

export const reportApiReachable = (reachable: boolean) => {
  if (apiReachable === reachable) return;
  apiReachable = reachable;
  emit();
};
