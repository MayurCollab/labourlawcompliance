import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi } from '@/api/users.api';
import type {
  CreateUserPayload,
  ListUsersParams,
  UpdateUserPayload,
} from '@/types/user.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const usersQueryKeys = {
  all: ['users'] as const,
  list: (params: ListUsersParams) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

/** Users list mutates often — keep data fresh for the admin table. */
export const useUsersQuery = (params: ListUsersParams) =>
  useQuery({
    queryKey: usersQueryKeys.list(params),
    queryFn: () => usersApi.list(params),
    staleTime: 15_000,
  });

export const useCreateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['users', 'create'],
    mutationFn: async ({
      payload,
      avatar,
    }: {
      payload: CreateUserPayload;
      avatar?: File | null;
    }) => {
      const user = await usersApi.create(payload);
      if (avatar) {
        return usersApi.uploadAvatar(user.id, avatar);
      }
      return user;
    },
    onSuccess: () => {
      toastSuccess('User created successfully');
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not create user'));
    },
  });
};

export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['users', 'update'],
    mutationFn: async ({
      id,
      payload,
      avatar,
    }: {
      id: string;
      payload: UpdateUserPayload;
      avatar?: File | null;
    }) => {
      const user = await usersApi.update(id, payload);
      if (avatar) {
        return usersApi.uploadAvatar(id, avatar);
      }
      return user;
    },
    onSuccess: () => {
      toastSuccess('User updated successfully');
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update user'));
    },
  });
};

export const useSetUserStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['users', 'status'],
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.setStatus(id, isActive),
    onSuccess: (_data, variables) => {
      toastSuccess(
        variables.isActive ? 'User activated' : 'User deactivated',
      );
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update user status'));
    },
  });
};

export const useDeleteUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['users', 'delete'],
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toastSuccess('User deleted successfully');
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete user'));
    },
  });
};
