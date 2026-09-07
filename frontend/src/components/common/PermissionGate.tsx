import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { usePermission } from '@/hooks/usePermission';
import { PATHS } from '@/routes/paths';

type PermissionGateProps = {
  permission: string;
  children: ReactNode;
  /** When true, redirects to /403 instead of rendering nothing. */
  redirect?: boolean;
  fallback?: ReactNode;
};

/**
 * Conditionally renders children based on a permission string.
 * Logic mirrors usePermission so route guards and UI gates stay consistent.
 */
export function PermissionGate({
  permission,
  children,
  redirect = false,
  fallback = null,
}: PermissionGateProps) {
  const { allowed } = usePermission(permission);

  if (allowed) {
    return <>{children}</>;
  }

  if (redirect) {
    return <Navigate to={PATHS.forbidden} replace />;
  }

  return <>{fallback}</>;
}
