import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { whatsappSendsApi } from '@/api/whatsappSends.api';
import type { ListWhatsAppSendsParams } from '@/types/whatsappSend.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const whatsappSendsQueryKeys = {
  all: ['whatsapp-sends'] as const,
  list: (params: ListWhatsAppSendsParams) =>
    ['whatsapp-sends', 'list', params] as const,
};

export const useWhatsAppSendsQuery = (
  params: ListWhatsAppSendsParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: whatsappSendsQueryKeys.list(params),
    queryFn: () => whatsappSendsApi.list(params),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });

export const useRefreshWhatsAppSendsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['whatsapp-sends', 'refresh-status'],
    mutationFn: () => whatsappSendsApi.refreshStatus(),
    onSuccess: (result) => {
      if (result.providerError) {
        toastError(
          `Could not refresh from MSG91 (${result.providerError}). Showing saved statuses.`,
        );
      } else if (result.updated > 0) {
        toastSuccess(
          `Updated ${result.updated} WhatsApp ${result.updated === 1 ? 'status' : 'statuses'}.`,
        );
      } else {
        toastSuccess('WhatsApp statuses are up to date.');
      }
      void queryClient.invalidateQueries({
        queryKey: whatsappSendsQueryKeys.all,
      });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not refresh WhatsApp statuses'));
      void queryClient.invalidateQueries({
        queryKey: whatsappSendsQueryKeys.all,
      });
    },
  });
};

export const useDeleteWhatsAppSendMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['whatsapp-sends', 'delete'],
    mutationFn: (id: string) => whatsappSendsApi.remove(id),
    onSuccess: () => {
      toastSuccess('WhatsApp send deleted');
      void queryClient.invalidateQueries({
        queryKey: whatsappSendsQueryKeys.all,
      });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not delete WhatsApp send'));
    },
  });
};
