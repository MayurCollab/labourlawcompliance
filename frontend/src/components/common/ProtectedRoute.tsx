import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';

/**
 * Wraps authenticated app routes. Redirects to login when there is no
 * session (after bootstrap finishes).
 */
export function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={PATHS.login} replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}
