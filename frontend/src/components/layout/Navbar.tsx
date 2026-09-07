import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, LogOut, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/buttons/Button';
import { useTheme } from '@/context/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';
import { cn } from '@/lib/utils';

export type NavbarProps = {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  showThemeToggle?: boolean;
  showUserMenu?: boolean;
};

/**
 * Top navbar with optional title/actions, theme toggle, and user menu
 * (profile label + logout). Feature-agnostic — no hard-coded page links.
 */
export function Navbar({
  title,
  actions,
  className,
  showThemeToggle = true,
  showUserMenu = true,
}: NavbarProps) {
  const { user, logout, isLoggingOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      aria-label="Application"
      className={cn(
        'relative flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4',
        className,
      )}
    >
      <div className="min-w-0">
        {title ?? (
          <>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-medium">{user?.name ?? '—'}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}

        {showThemeToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        ) : null}

        {showUserMenu ? (
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-controls="account-menu"
              leftIcon={
                <Avatar
                  name={user?.name}
                  src={user?.avatar}
                  size="sm"
                  className="size-5"
                  loading="eager"
                />
              }
              onClick={() => setMenuOpen((open) => !open)}
            >
              Account
            </Button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  id="account-menu"
                  role="menu"
                  aria-label="Account"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-40 mt-2 w-52 rounded-lg border border-border bg-popover p-1 shadow-md"
                >
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-sm font-medium">
                      {user?.name ?? 'User'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <Link
                    role="menuitem"
                    to={PATHS.changePassword}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    <KeyRound className="size-4" aria-hidden />
                    Change password
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-muted disabled:opacity-50"
                    disabled={isLoggingOut}
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                  >
                    <LogOut className="size-4" aria-hidden />
                    Logout
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </header>
  );
}
