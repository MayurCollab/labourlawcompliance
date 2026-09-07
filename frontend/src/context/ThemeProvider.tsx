import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  loadPersistedTheme,
  savePersistedTheme,
  type ThemeMode,
} from '@/utils/storage';

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const resolveTheme = (theme: ThemeMode): 'light' | 'dark' =>
  theme === 'system' ? getSystemTheme() : theme;

const applyThemeClass = (resolved: 'light' | 'dark') => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
};

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Theme is owned by React context (not Redux) — UI chrome only, no
 * server state. Preference is persisted in localStorage.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => loadPersistedTheme());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : getSystemTheme(),
  );

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    applyThemeClass(resolvedTheme);
    savePersistedTheme(theme);
  }, [resolvedTheme, theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(getSystemTheme());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const resolved = resolveTheme(current);
      return resolved === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
