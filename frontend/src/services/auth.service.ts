import { authApi } from '@/api/auth.api';
import { store } from '@/store';
import {
  clearCredentials,
  setAccessToken,
  setBootstrapping,
  setCredentials,
  setUser,
} from '@/store/slices/authSlice';
import type { LoginPayload, RegisterPayload } from '@/types/auth.types';
import { clearCsrfToken } from '@/utils/csrf';
import { clearPersistedAuth, loadPersistedAuth } from '@/utils/storage';

/**
 * On app load: if we previously had a session, silently refresh the access
 * token via the httpOnly cookie, then hydrate the user (+ permissions).
 * Access tokens are never persisted — only re-obtained here.
 */
export const bootstrapAuthSession = async () => {
  const persisted = loadPersistedAuth();

  if (!persisted?.user) {
    store.dispatch(setBootstrapping(false));
    return;
  }

  try {
    const accessToken = await authApi.refreshToken();
    store.dispatch(setAccessToken(accessToken));

    const user = await authApi.getMe();
    store.dispatch(
      setCredentials({
        user,
        accessToken,
        permissions: user.permissions ?? [],
      }),
    );
  } catch {
    store.dispatch(clearCredentials());
  } finally {
    store.dispatch(setBootstrapping(false));
  }
};

export const loginWithCredentials = async (
  payload: LoginPayload,
  options?: { rememberMe?: boolean },
) => {
  const credentials = await authApi.login(payload);
  store.dispatch(setCredentials(credentials));

  // "Remember me" unchecked → keep session in memory only (no localStorage)
  if (options?.rememberMe === false) {
    clearPersistedAuth();
  }

  return credentials;
};

export const registerAccount = async (payload: RegisterPayload) => {
  return authApi.register(payload);
};

export const logoutSession = async () => {
  try {
    await authApi.logout();
  } catch {
    // Clear local session even if the network call fails
  } finally {
    clearCsrfToken();
    store.dispatch(clearCredentials());
  }
};

export const refreshCurrentUser = async () => {
  const user = await authApi.getMe();
  store.dispatch(setUser(user));
  return user;
};
