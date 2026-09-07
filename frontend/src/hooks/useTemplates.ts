import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { templatesApi } from '@/api/templates.api';
import { clientsQueryKeys, locationsQueryKeys } from '@/hooks/useClients';
import { filingsQueryKeys } from '@/hooks/useFilings';
import type {
  AssignTemplatePayload,
  ListTemplatesParams,
  TemplateMapping,
} from '@/types/template.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const templatesQueryKeys = {
  all: ['templates'] as const,
  list: (params: ListTemplatesParams) => ['templates', 'list', params] as const,
  detail: (id: string) => ['templates', 'detail', id] as const,
  canonical: ['templates', 'canonical'] as const,
  resolve: (clientId: string) => ['templates', 'resolve', clientId] as const,
  bundled: ['templates', 'bundled'] as const,
};

export const useTemplatesQuery = (params: ListTemplatesParams) =>
  useQuery({
    queryKey: templatesQueryKeys.list(params),
    queryFn: () => templatesApi.list(params),
    staleTime: 15_000,
  });

export const useCanonicalSchemaQuery = () =>
  useQuery({
    queryKey: templatesQueryKeys.canonical,
    queryFn: () => templatesApi.canonical(),
    staleTime: 60_000,
  });

export const useResolveTemplateQuery = (
  clientId: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: templatesQueryKeys.resolve(clientId),
    queryFn: () => templatesApi.resolve(clientId),
    enabled: options?.enabled ?? Boolean(clientId),
  });

export const useBundledTemplatesQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: templatesQueryKeys.bundled,
    queryFn: () => templatesApi.listBundled(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

export const useCreateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['templates', 'create'],
    mutationFn: ({ file, name }: { file: File; name?: string }) =>
      templatesApi.create(file, name),
    onSuccess: () => {
      toastSuccess('Template uploaded');
      void queryClient.invalidateQueries({ queryKey: templatesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not upload this template'));
    },
  });
};

export const useUpdateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['templates', 'update'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name?: string; mapping?: TemplateMapping };
    }) => templatesApi.update(id, payload),
    onSuccess: (template) => {
      toastSuccess('Mapping saved');
      void queryClient.invalidateQueries({ queryKey: templatesQueryKeys.all });
      queryClient.setQueryData(
        templatesQueryKeys.detail(template.id),
        template,
      );
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not save mapping'));
    },
  });
};

export const useAssignTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['templates', 'assign'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AssignTemplatePayload;
    }) => templatesApi.assign(id, payload),
    onSuccess: () => {
      toastSuccess('Assignment saved');
      void queryClient.invalidateQueries({ queryKey: templatesQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not assign this template'));
    },
  });
};

export const useDeleteTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['templates', 'delete'],
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: () => {
      toastSuccess('Template deleted');
      void queryClient.invalidateQueries({ queryKey: templatesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete this template'));
    },
  });
};
