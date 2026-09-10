import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clientsApi, locationsApi } from '@/api/clients.api';
import type {
  ClientPayload,
  ListClientsParams,
  UpdateClientPayload,
} from '@/types/client.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const clientsQueryKeys = {
  all: ['clients'] as const,
  list: (params: ListClientsParams) => ['clients', 'list', params] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
};

export const locationsQueryKeys = {
  all: ['locations'] as const,
  list: ['locations', 'list'] as const,
};

export const useClientsQuery = (
  params: ListClientsParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: clientsQueryKeys.list(params),
    queryFn: () => clientsApi.list(params),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });

export const useClientOptionsQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...clientsQueryKeys.all, 'options'] as const,
    queryFn: () => clientsApi.options(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

export const useLocationsQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: locationsQueryKeys.list,
    queryFn: () => locationsApi.list(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

export const useCreateClientMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['clients', 'create'],
    mutationFn: (payload: ClientPayload) => clientsApi.create(payload),
    onSuccess: () => {
      toastSuccess('Client created successfully');
      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not create client'));
    },
  });
};

export const useUpdateClientMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['clients', 'update'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateClientPayload;
    }) => clientsApi.update(id, payload),
    onSuccess: () => {
      toastSuccess('Client updated successfully');
      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['filings'] });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update client'));
    },
  });
};

export const useExportClientsMutation = () =>
  useMutation({
    mutationKey: ['clients', 'export'],
    mutationFn: (
      params: Pick<
        ListClientsParams,
        'search' | 'locationId' | 'locationIds' | 'fundCode' | 'sortBy' | 'sortOrder'
      > = {},
    ) => clientsApi.exportExcel(params),
    onSuccess: () => {
      toastSuccess('Download started');
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not download clients'));
    },
  });

export const useDeleteClientMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['clients', 'delete'],
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      toastSuccess('Client deleted successfully');
      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete client'));
    },
  });
};
