import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ptSlabsApi, settingsApi } from '@/api/masters.api';
import type { AppSettings, PtSlabPayload } from '@/types/masters.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const ptSlabsQueryKeys = {
  all: ['pt-slabs'] as const,
  list: ['pt-slabs', 'list'] as const,
};

export const settingsQueryKeys = {
  all: ['settings'] as const,
};

export const usePtSlabsQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ptSlabsQueryKeys.list,
    queryFn: () => ptSlabsApi.list(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

export const useCreatePtSlabMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['pt-slabs', 'create'],
    mutationFn: (payload: PtSlabPayload) => ptSlabsApi.create(payload),
    onSuccess: () => {
      toastSuccess('PT slab created');
      void queryClient.invalidateQueries({ queryKey: ptSlabsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not create PT slab'));
    },
  });
};

export const useUpdatePtSlabMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['pt-slabs', 'update'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<PtSlabPayload>;
    }) => ptSlabsApi.update(id, payload),
    onSuccess: () => {
      toastSuccess('PT slab updated');
      void queryClient.invalidateQueries({ queryKey: ptSlabsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not update PT slab'));
    },
  });
};

export const useDeletePtSlabMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['pt-slabs', 'delete'],
    mutationFn: (id: string) => ptSlabsApi.remove(id),
    onSuccess: () => {
      toastSuccess('PT slab deleted');
      void queryClient.invalidateQueries({ queryKey: ptSlabsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete PT slab'));
    },
  });
};

export const useSettingsQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: settingsQueryKeys.all,
    queryFn: () => settingsApi.get(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

export const useUpdateSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['settings', 'update'],
    mutationFn: (payload: AppSettings) => settingsApi.update(payload),
    onSuccess: () => {
      toastSuccess('Default signatory saved');
      void queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not save settings'));
    },
  });
};
