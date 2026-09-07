import { Navigate, Outlet } from 'react-router-dom';

import { usePermission } from '@/hooks/usePermission';
import { PATHS } from '@/routes/paths';

type PermissionRouteProps = {
  permission: string;
};

/**
 * Route-level permission guard. Place inside ProtectedRoute.
 * Usage: <Route element={<PermissionRoute permission="users.view" />}>…
 */
export function PermissionRoute({ permission }: PermissionRouteProps) {
  const { allowed } = usePermission(permission);

  if (!allowed) {
    return <Navigate to={PATHS.forbidden} replace />;
  }

  return <Outlet />;
}
