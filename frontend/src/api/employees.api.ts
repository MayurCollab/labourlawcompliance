import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  ListEmployeesParams,
  ListEmployeesResult,
} from '@/types/employee.types';

const toQuery = (params: ListEmployeesParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.period) query.period = params.period;
  if (params.clientId) query.clientId = params.clientId;
  if (params.phyCode) query.phyCode = params.phyCode;
  if (params.unmatched !== undefined) {
    query.unmatched = String(params.unmatched);
  }
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

export const employeesApi = {
  list: async (
    params: ListEmployeesParams = {},
  ): Promise<ListEmployeesResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListEmployeesResult>
    >('/api/v1/employees', { params: toQuery(params) });
    return data.data;
  },
};
