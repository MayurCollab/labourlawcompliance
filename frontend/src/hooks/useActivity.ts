import { useQuery } from '@tanstack/react-query';

import { activityApi } from '@/api/activity.api';
import type { ListActivityParams } from '@/types/activity.types';

export const activityQueryKeys = {
  list: (params: ListActivityParams) => ['activity', 'list', params] as const,
};

export const useActivityQuery = (
  params: ListActivityParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: activityQueryKeys.list(params),
    queryFn: () => activityApi.list(params),
    enabled: options?.enabled ?? true,
    staleTime: 10_000,
  });
