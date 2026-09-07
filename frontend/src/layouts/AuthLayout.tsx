import { Outlet } from 'react-router-dom';

import { APP_NAME } from '@/constants/app';

/**
 * Shell for public auth pages (login, register, forgot/reset password,
 * verify email). Each page supplies its own title/body inside the card.
 */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_transparent_55%)]" />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
