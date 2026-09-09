import { Outlet } from 'react-router-dom';

import { APP_NAME } from '@/constants/app';

/**
 * Shell for public auth pages (login, register, forgot/reset password,
 * verify email). Each page supplies its own title/body inside the card.
 */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklch,var(--primary)_18%,transparent)_0%,_transparent_55%)]" />
      <div className="relative w-full max-w-md rounded-xl border border-border/80 bg-card/95 p-6 text-card-foreground shadow-lg ring-1 ring-primary/10 backdrop-blur-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight text-primary">{APP_NAME}</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
