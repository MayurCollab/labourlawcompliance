import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { whatsappSendsApi } from '@/api/whatsappSends.api';
import type {
  ListWhatsAppSendsParams,
  WhatsAppFailureSummaryParams,
} from '@/types/whatsappSend.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const whatsappSendsQueryKeys = {
  all: ['whatsapp-sends'] as const,
  list: (params: ListWhatsAppSendsParams) =>
    ['whatsapp-sends', 'list', params] as const,
  failureSummary: (params: WhatsAppFailureSummaryParams) =>
    ['whatsapp-sends', 'failure-summary', params] as const,
  suppressions: (page: number, limit: number) =>
    ['whatsapp-sends', 'suppressions', page, limit] as const,
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

export const useWhatsAppFailureSummaryQuery = (
  params: WhatsAppFailureSummaryParams,
) =>
  useQuery({
    queryKey: whatsappSendsQueryKeys.failureSummary(params),
    queryFn: () => whatsappSendsApi.failureSummary(params),
    staleTime: 15_000,
  });

export const useWhatsAppSuppressionsQuery = (page: number, limit = 20) =>
  useQuery({
    queryKey: whatsappSendsQueryKeys.suppressions(page, limit),
    queryFn: () => whatsappSendsApi.listSuppressions(page, limit),
    staleTime: 15_000,
  });

export const useRemoveWhatsAppSuppressionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['whatsapp-sends', 'suppressions', 'remove'],
    mutationFn: (id: string) => whatsappSendsApi.removeSuppression(id),
    onSuccess: () => {
      toastSuccess('Contact removed from the suppression list');
      void queryClient.invalidateQueries({
        queryKey: ['whatsapp-sends', 'suppressions'],
      });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not remove contact from suppression list'));
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
