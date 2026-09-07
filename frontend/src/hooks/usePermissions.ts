import { useQuery } from '@tanstack/react-query';

import { permissionsApi } from '@/api/permissions.api';

export const permissionsQueryKeys = {
  all: ['permissions'] as const,
  list: ['permissions', 'list'] as const,
  grouped: ['permissions', 'grouped'] as const,
};

/** Permission catalogue is effectively static after seed. */
export const usePermissionsQuery = () =>
  useQuery({
    queryKey: permissionsQueryKeys.list,
    queryFn: () => permissionsApi.list(),
    staleTime: 10 * 60_000,
  });

export const useGroupedPermissionsQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: permissionsQueryKeys.grouped,
    queryFn: () => permissionsApi.listGrouped(),
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60_000,
  });
