import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type { User } from '@/types/auth.types';
import type {
  CreateUserPayload,
  ListUsersParams,
  ListUsersResult,
  UpdateUserPayload,
} from '@/types/user.types';

const toQuery = (params: ListUsersParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.role) query.role = params.role;
  if (params.isActive !== undefined) query.isActive = String(params.isActive);
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

export const usersApi = {
  list: async (params: ListUsersParams = {}): Promise<ListUsersResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListUsersResult>
    >('/api/v1/users', { params: toQuery(params) });
    return data.data;
  },

  getById: async (id: string): Promise<User> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ user: User }>
    >(`/api/v1/users/${id}`);
    return data.data.user;
  },

  create: async (payload: CreateUserPayload): Promise<User> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ user: User }>
    >('/api/v1/users', payload);
    return data.data.user;
  },

  update: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ user: User }>
    >(`/api/v1/users/${id}`, payload);
    return data.data.user;
  },

  setStatus: async (id: string, isActive: boolean): Promise<User> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ user: User }>
    >(`/api/v1/users/${id}/status`, { isActive });
    return data.data.user;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/users/${id}`);
  },

  uploadAvatar: async (id: string, file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ user: User }>
    >(`/api/v1/users/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.user;
  },
};
