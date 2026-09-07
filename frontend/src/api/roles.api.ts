import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  CreateRolePayload,
  Role,
  UpdateRolePayload,
} from '@/types/role.types';

export const rolesApi = {
  list: async (): Promise<Role[]> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ roles: Role[] }>
    >('/api/v1/roles');
    return data.data.roles;
  },

  getById: async (id: string): Promise<Role> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ role: Role }>
    >(`/api/v1/roles/${id}`);
    return data.data.role;
  },

  create: async (payload: CreateRolePayload): Promise<Role> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ role: Role }>
    >('/api/v1/roles', payload);
    return data.data.role;
  },

  update: async (id: string, payload: UpdateRolePayload): Promise<Role> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ role: Role }>
    >(`/api/v1/roles/${id}`, payload);
    return data.data.role;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/roles/${id}`);
  },

  updatePermissions: async (
    id: string,
    permissions: string[],
  ): Promise<Role> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ role: Role }>
    >(`/api/v1/roles/${id}/permissions`, { permissions });
    return data.data.role;
  },

  assignUsers: async (
    id: string,
    userIds: string[],
  ): Promise<{ assignedCount: number }> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ assignedCount: number }>
    >(`/api/v1/roles/${id}/assign-users`, { userIds });
    return data.data;
  },
};
