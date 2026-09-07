import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient.
 *
 * Default staleTime is short (30s) for list endpoints that change often.
 * Individual hooks override for catalogues (roles/permissions) that barely
 * change during a session — see useRoles / usePermissions.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
