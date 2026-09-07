import { useQuery } from '@tanstack/react-query';

import { employeesApi } from '@/api/employees.api';
import type { ListEmployeesParams } from '@/types/employee.types';

export const employeesQueryKeys = {
  all: ['employees'] as const,
  list: (params: ListEmployeesParams) =>
    ['employees', 'list', params] as const,
};

export const useEmployeesQuery = (
  params: ListEmployeesParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: employeesQueryKeys.list(params),
    queryFn: () => employeesApi.list(params),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
