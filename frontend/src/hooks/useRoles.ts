import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rolesApi } from '@/api/roles.api';
import type { CreateRolePayload, UpdateRolePayload } from '@/types/role.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const rolesQueryKeys = {
  all: ['roles'] as const,
  list: ['roles', 'list'] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
};

/** Roles change rarely — cache for the length of a typical admin session. */
export const useRolesQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: rolesQueryKeys.list,
    queryFn: () => rolesApi.list(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
  });

export const useRoleQuery = (id: string | null) =>
  useQuery({
    queryKey: rolesQueryKeys.detail(id ?? ''),
    queryFn: () => rolesApi.getById(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

export const useCreateRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['roles', 'create'],
    mutationFn: (payload: CreateRolePayload) => rolesApi.create(payload),
    onSuccess: () => {
      toastSuccess('Role created successfully');
      void queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not create role'));
    },
  });
};

export const useUpdateRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['roles', 'update'],
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) =>
      rolesApi.update(id, payload),
    onSuccess: () => {
      toastSuccess('Role updated successfully');
      void queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update role'));
    },
  });
};

export const useDeleteRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['roles', 'delete'],
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      toastSuccess('Role deleted successfully');
      void queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete role'));
    },
  });
};

export const useUpdateRolePermissionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['roles', 'permissions'],
    mutationFn: ({
      id,
      permissions,
    }: {
      id: string;
      permissions: string[];
    }) => rolesApi.updatePermissions(id, permissions),
    onSuccess: () => {
      toastSuccess('Role permissions updated');
      void queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update permissions'));
    },
  });
};
