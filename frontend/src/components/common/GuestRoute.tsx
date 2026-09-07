import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';

/**
 * Public-only routes (login/register/etc). Authenticated users are sent home.
 */
export function GuestRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={PATHS.home} replace />;
  }

  return <Outlet />;
}
