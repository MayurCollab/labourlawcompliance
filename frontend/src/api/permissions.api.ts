import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type { GroupedPermissions, Permission } from '@/types/role.types';

export const permissionsApi = {
  list: async (): Promise<Permission[]> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ permissions: Permission[] }>
    >('/api/v1/permissions');
    return data.data.permissions;
  },

  listGrouped: async (): Promise<GroupedPermissions> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ permissions: GroupedPermissions }>
    >('/api/v1/permissions', { params: { grouped: 'true' } });
    return data.data.permissions;
  },
};
