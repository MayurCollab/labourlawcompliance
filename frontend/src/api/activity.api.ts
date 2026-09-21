import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  ListActivityParams,
  ListActivityResult,
} from '@/types/activity.types';

const toQuery = (params: ListActivityParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.action) query.action = params.action;
  if (params.entityType) query.entityType = params.entityType;
  if (params.entityId) query.entityId = params.entityId;
  if (params.actorId) query.actorId = params.actorId;
  return query;
};

export const activityApi = {
  /** Read-only audit log — there is no write endpoint, by design. */
  list: async (
    params: ListActivityParams = {},
  ): Promise<ListActivityResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListActivityResult>
    >('/api/v1/activity', { params: toQuery(params) });
    return data.data;
  },
};
