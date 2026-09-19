import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { employeesApi } from '@/api/employees.api';
import type {
  EmployeePayload,
  ListEmployeesParams,
  UpdateEmployeePayload,
} from '@/types/employee.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

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

/** Silent lookup for the Add Employee form's autofill — no toasts on either outcome. */
export const useEmployeeLookup = () =>
  useMutation({
    mutationKey: ['employees', 'lookup'],
    mutationFn: employeesApi.lookup,
  });

export const useCreateEmployeeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['employees', 'create'],
    mutationFn: (payload: EmployeePayload) => employeesApi.create(payload),
    onSuccess: () => {
      toastSuccess('Employee created successfully');
      void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not create employee'));
    },
  });
};

export const useUpdateEmployeeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['employees', 'update'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateEmployeePayload;
    }) => employeesApi.update(id, payload),
    onSuccess: () => {
      toastSuccess('Employee updated successfully');
      void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update employee'));
    },
  });
};

export const useDeleteEmployeeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['employees', 'delete'],
    mutationFn: (id: string) => employeesApi.remove(id),
    onSuccess: () => {
      toastSuccess('Employee deleted successfully');
      void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete employee'));
    },
  });
};
