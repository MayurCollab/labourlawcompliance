import { useQuery } from '@tanstack/react-query';

import { whatsappSendsApi } from '@/api/whatsappSends.api';
import type { ListWhatsAppSendsParams } from '@/types/whatsappSend.types';

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
