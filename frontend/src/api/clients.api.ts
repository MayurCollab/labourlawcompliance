import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  Client,
  ClientOptionsResult,
  ClientPayload,
  ListClientsParams,
  ListClientsResult,
  Location,
  UpdateClientPayload,
} from '@/types/client.types';

const toQuery = (params: ListClientsParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.locationId) query.locationId = params.locationId;
  if (params.fundCode) query.fundCode = params.fundCode;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

export const clientsApi = {
  list: async (params: ListClientsParams = {}): Promise<ListClientsResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListClientsResult>
    >('/api/v1/clients', { params: toQuery(params) });
    return data.data;
  },

  getById: async (id: string): Promise<Client> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ client: Client }>
    >(`/api/v1/clients/${id}`);
    return data.data.client;
  },

  create: async (payload: ClientPayload): Promise<Client> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ client: Client }>
    >('/api/v1/clients', payload);
    return data.data.client;
  },

  update: async (id: string, payload: UpdateClientPayload): Promise<Client> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ client: Client }>
    >(`/api/v1/clients/${id}`, payload);
    return data.data.client;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/clients/${id}`);
  },

  options: async (): Promise<ClientOptionsResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ClientOptionsResult>
    >('/api/v1/clients/options');
    return data.data;
  },
};

export const locationsApi = {
  list: async (): Promise<Location[]> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ locations: Location[] }>
    >('/api/v1/locations');
    return data.data.locations;
  },
};
