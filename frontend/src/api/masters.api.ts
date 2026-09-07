import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  AppSettings,
  PtSlab,
  PtSlabPayload,
} from '@/types/masters.types';

export const ptSlabsApi = {
  list: async (): Promise<PtSlab[]> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ slabs: PtSlab[] }>
    >('/api/v1/pt-slabs');
    return data.data.slabs;
  },

  create: async (payload: PtSlabPayload): Promise<PtSlab> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ slab: PtSlab }>
    >('/api/v1/pt-slabs', payload);
    return data.data.slab;
  },

  update: async (id: string, payload: Partial<PtSlabPayload>): Promise<PtSlab> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ slab: PtSlab }>
    >(`/api/v1/pt-slabs/${id}`, payload);
    return data.data.slab;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/pt-slabs/${id}`);
  },
};

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ settings: AppSettings }>
    >('/api/v1/settings');
    return data.data.settings;
  },

  update: async (payload: AppSettings): Promise<AppSettings> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ settings: AppSettings }>
    >('/api/v1/settings', payload);
    return data.data.settings;
  },
};
