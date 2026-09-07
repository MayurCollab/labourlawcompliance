import { useCallback, useMemo } from 'react';

import { useAppSelector } from '@/store/hooks';

/**
 * Permission checks for components — mirrors PermissionGate logic so both
 * stay consistent (same source: auth.permissions in the store).
 */
export const usePermission = (permission?: string) => {
  const permissions = useAppSelector((state) => state.auth.permissions);

  const hasPermission = useCallback(
    (key: string) => permissions.includes(key),
    [permissions],
  );

  const allowed = useMemo(() => {
    if (!permission) return true;
    return permissions.includes(permission);
  }, [permission, permissions]);

  return {
    allowed,
    permissions,
    hasPermission,
  };
};
