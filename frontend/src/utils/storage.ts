import type { User } from '@/types/auth.types';

const AUTH_PERSIST_KEY = 'blueprint_auth';

type PersistedAuth = {
  user: User | null;
  permissions: string[];
};

/** Persist only safe auth fields — never the access token. */
export const loadPersistedAuth = (): PersistedAuth | null => {
  try {
    const raw = localStorage.getItem(AUTH_PERSIST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAuth;
  } catch {
    return null;
  }
};

export const savePersistedAuth = (payload: PersistedAuth) => {
  localStorage.setItem(AUTH_PERSIST_KEY, JSON.stringify(payload));
};

export const clearPersistedAuth = () => {
  localStorage.removeItem(AUTH_PERSIST_KEY);
};

const THEME_KEY = 'blueprint_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export const loadPersistedTheme = (): ThemeMode => {
  const value = localStorage.getItem(THEME_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
};

export const savePersistedTheme = (theme: ThemeMode) => {
  localStorage.setItem(THEME_KEY, theme);
};
