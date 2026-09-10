import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  ListWhatsAppSendsParams,
  ListWhatsAppSendsResult,
} from '@/types/whatsappSend.types';

const toQuery = (params: ListWhatsAppSendsParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.period) query.period = params.period;
  if (params.clientId) query.clientId = params.clientId;
  if (params.clientIds?.length) query.clientIds = params.clientIds.join(',');
  if (params.status) query.status = params.status;
  if (params.phone) query.phone = params.phone;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

export const whatsappSendsApi = {
  list: async (
    params: ListWhatsAppSendsParams = {},
  ): Promise<ListWhatsAppSendsResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListWhatsAppSendsResult>
    >('/api/v1/whatsapp-sends', { params: toQuery(params) });
    return data.data;
  },
};
