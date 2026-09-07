import { useCallback, useMemo } from 'react';

import { useLogoutMutation } from '@/hooks/useAuthMutations';
import { refreshCurrentUser } from '@/services/auth.service';
import { useAppSelector } from '@/store/hooks';

/**
 * Auth session surface for components — current user + logout.
 * Login/register/password flows live in `useAuthMutations`.
 */
export const useAuth = () => {
  const { user, accessToken, isAuthenticated, permissions, isBootstrapping } =
    useAppSelector((state) => state.auth);
  const logoutMutation = useLogoutMutation();

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const refreshUser = useCallback(async () => {
    return refreshCurrentUser();
  }, []);

  return useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated,
      permissions,
      isBootstrapping,
      logout,
      isLoggingOut: logoutMutation.isPending,
      refreshUser,
    }),
    [
      user,
      accessToken,
      isAuthenticated,
      permissions,
      isBootstrapping,
      logout,
      logoutMutation.isPending,
      refreshUser,
    ],
  );
};
