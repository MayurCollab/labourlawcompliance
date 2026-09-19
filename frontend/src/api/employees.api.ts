import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  Employee,
  EmployeeLookupParams,
  EmployeePayload,
  ListEmployeesParams,
  ListEmployeesResult,
  UpdateEmployeePayload,
} from '@/types/employee.types';

const toQuery = (params: ListEmployeesParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.period) query.period = params.period;
  if (params.clientId) query.clientId = params.clientId;
  if (params.clientIds?.length) query.clientIds = params.clientIds.join(',');
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

  getById: async (id: string): Promise<Employee> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ employee: Employee }>
    >(`/api/v1/employees/${id}`);
    return data.data.employee;
  },

  lookup: async (params: EmployeeLookupParams): Promise<Employee | null> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ employee: Employee | null }>
    >('/api/v1/employees/lookup', { params });
    return data.data.employee;
  },

  create: async (payload: EmployeePayload): Promise<Employee> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ employee: Employee }>
    >('/api/v1/employees', payload);
    return data.data.employee;
  },

  update: async (
    id: string,
    payload: UpdateEmployeePayload,
  ): Promise<Employee> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ employee: Employee }>
    >(`/api/v1/employees/${id}`, payload);
    return data.data.employee;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/employees/${id}`);
  },
};
