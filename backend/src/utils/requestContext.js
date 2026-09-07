import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AsyncLocalStorage-based request context.
 * The requestId middleware runs each request inside this store so that
 * any code (e.g. the logger) can read the current request id without
 * having to pass `req` around.
 *
 * Fields: requestId, method, path, route, userId.
 */
export const requestContext = new AsyncLocalStorage();

export const getRequestContext = () => requestContext.getStore();

export const getRequestId = () => requestContext.getStore()?.requestId;

/**
 * Merges extra correlation fields into the active context.
 * Used by the auth middleware (userId) and the router (matched route),
 * which only know their values after the context has been created.
 */
export const setRequestContext = (patch) => {
  const store = requestContext.getStore();
  if (store) {
    Object.assign(store, patch);
  }
};
