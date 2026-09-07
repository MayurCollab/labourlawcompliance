import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  AssignTemplatePayload,
  BundledTemplate,
  CanonicalSchema,
  ListTemplatesParams,
  ListTemplatesResult,
  ResolveTemplateResult,
  TemplateDetail,
  TemplateMapping,
} from '@/types/template.types';

const toQuery = (params: ListTemplatesParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

export const templatesApi = {
  canonical: async (): Promise<CanonicalSchema> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<CanonicalSchema>
    >('/api/v1/templates/canonical');
    return data.data;
  },

  list: async (
    params: ListTemplatesParams = {},
  ): Promise<ListTemplatesResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListTemplatesResult>
    >('/api/v1/templates', { params: toQuery(params) });
    return data.data;
  },

  resolve: async (clientId: string): Promise<ResolveTemplateResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ResolveTemplateResult>
    >('/api/v1/templates/resolve', { params: { clientId } });
    return data.data;
  },

  listBundled: async (): Promise<BundledTemplate[]> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ templates: BundledTemplate[] }>
    >('/api/v1/templates/bundled');
    return data.data.templates;
  },

  fetchBundledPreviewHtml: async (code: string): Promise<string> => {
    const response = await axiosInstance.get(
      `/api/v1/templates/bundled/${encodeURIComponent(code)}/preview`,
      { responseType: 'text' },
    );
    return response.data as string;
  },

  getById: async (id: string): Promise<TemplateDetail> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ template: TemplateDetail }>
    >(`/api/v1/templates/${id}`);
    return data.data.template;
  },

  create: async (file: File, name?: string): Promise<TemplateDetail> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ template: TemplateDetail }>
    >('/api/v1/templates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.template;
  },

  update: async (
    id: string,
    payload: { name?: string; mapping?: TemplateMapping },
  ): Promise<TemplateDetail> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ template: TemplateDetail }>
    >(`/api/v1/templates/${id}`, payload);
    return data.data.template;
  },

  assign: async (
    id: string,
    payload: AssignTemplatePayload,
  ): Promise<TemplateDetail> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ template: TemplateDetail }>
    >(`/api/v1/templates/${id}/assign`, payload);
    return data.data.template;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/templates/${id}`);
  },
};
