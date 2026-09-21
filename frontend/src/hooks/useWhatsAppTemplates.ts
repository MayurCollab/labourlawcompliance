import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { whatsappTemplatesApi } from '@/api/whatsappTemplates.api';
import type {
  CreateWhatsAppTemplatePayload,
  ListWhatsAppTemplatesParams,
  UpdateWhatsAppTemplatePayload,
} from '@/types/whatsappTemplate.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const whatsappTemplatesQueryKeys = {
  all: ['whatsappTemplates'] as const,
  list: (params: ListWhatsAppTemplatesParams) =>
    ['whatsappTemplates', 'list', params] as const,
  detail: (id: string) => ['whatsappTemplates', 'detail', id] as const,
  fields: ['whatsappTemplates', 'fields'] as const,
};

/**
 * Query to list WhatsApp templates with pagination and filters
 */
export const useWhatsAppTemplatesQuery = (
  params: ListWhatsAppTemplatesParams,
  options?: { refetchOnMount?: boolean | 'always' },
) =>
  useQuery({
    queryKey: whatsappTemplatesQueryKeys.list(params),
    queryFn: () => whatsappTemplatesApi.list(params),
    staleTime: 15_000,
    ...(options?.refetchOnMount !== undefined
      ? { refetchOnMount: options.refetchOnMount }
      : {}),
  });

/**
 * Query to get a single WhatsApp template by ID
 */
export const useWhatsAppTemplateQuery = (
  id: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: whatsappTemplatesQueryKeys.detail(id),
    queryFn: () => whatsappTemplatesApi.getById(id),
    enabled: options?.enabled ?? Boolean(id),
  });

/**
 * Query to get available template fields for variable mapping
 */
export const useWhatsAppTemplateFieldsQuery = () =>
  useQuery({
    queryKey: whatsappTemplatesQueryKeys.fields,
    queryFn: () => whatsappTemplatesApi.fields(),
    staleTime: 60_000,
  });

/**
 * Mutation to create a new WhatsApp template
 */
export const useCreateWhatsAppTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['whatsappTemplates', 'create'],
    mutationFn: (payload: CreateWhatsAppTemplatePayload) =>
      whatsappTemplatesApi.create(payload),
    onSuccess: () => {
      toastSuccess('WhatsApp template created');
      void queryClient.invalidateQueries({
        queryKey: whatsappTemplatesQueryKeys.all,
      });
    },
    onError: (error) => {
      toastError(
        getApiErrorMessage(error, 'Could not create WhatsApp template'),
      );
    },
  });
};

/**
 * Mutation to update an existing WhatsApp template
 */
export const useUpdateWhatsAppTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['whatsappTemplates', 'update'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateWhatsAppTemplatePayload;
    }) => whatsappTemplatesApi.update(id, payload),
    onSuccess: (template) => {
      toastSuccess('WhatsApp template updated');
      void queryClient.invalidateQueries({
        queryKey: whatsappTemplatesQueryKeys.all,
      });
      queryClient.setQueryData(
        whatsappTemplatesQueryKeys.detail(template.id),
        template,
      );
    },
    onError: (error) => {
      toastError(
        getApiErrorMessage(error, 'Could not update WhatsApp template'),
      );
    },
  });
};

/**
 * Mutation to soft-delete a WhatsApp template
 */
export const useDeleteWhatsAppTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['whatsappTemplates', 'delete'],
    mutationFn: (id: string) => whatsappTemplatesApi.remove(id),
    onSuccess: () => {
      toastSuccess('WhatsApp template deleted');
      void queryClient.invalidateQueries({
        queryKey: whatsappTemplatesQueryKeys.all,
      });
    },
    onError: (error) => {
      toastError(
        getApiErrorMessage(error, 'Could not delete WhatsApp template'),
      );
    },
  });
};
