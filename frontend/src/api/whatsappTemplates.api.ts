import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  CreateWhatsAppTemplatePayload,
  ListWhatsAppTemplatesParams,
  ListWhatsAppTemplatesResult,
  UpdateWhatsAppTemplatePayload,
  WhatsAppTemplate,
  WhatsAppTemplateFieldsResult,
} from '@/types/whatsappTemplate.types';

const toQuery = (params: ListWhatsAppTemplatesParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.isActive !== undefined) query.isActive = String(params.isActive);
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

export const whatsappTemplatesApi = {
  /**
   * Get list of data fields available for template variable mapping
   */
  fields: async (): Promise<WhatsAppTemplateFieldsResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<WhatsAppTemplateFieldsResult>
    >('/api/v1/whatsapp-templates/fields');
    return data.data;
  },

  /**
   * List WhatsApp templates with pagination and filters
   */
  list: async (
    params: ListWhatsAppTemplatesParams = {},
  ): Promise<ListWhatsAppTemplatesResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListWhatsAppTemplatesResult>
    >('/api/v1/whatsapp-templates', { params: toQuery(params) });
    return data.data;
  },

  /**
   * Get a single WhatsApp template by ID
   */
  getById: async (id: string): Promise<WhatsAppTemplate> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ template: WhatsAppTemplate }>
    >(`/api/v1/whatsapp-templates/${id}`);
    return data.data.template;
  },

  /**
   * Create a new WhatsApp template
   */
  create: async (
    payload: CreateWhatsAppTemplatePayload,
  ): Promise<WhatsAppTemplate> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ template: WhatsAppTemplate }>
    >('/api/v1/whatsapp-templates', payload);
    return data.data.template;
  },

  /**
   * Update an existing WhatsApp template
   */
  update: async (
    id: string,
    payload: UpdateWhatsAppTemplatePayload,
  ): Promise<WhatsAppTemplate> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ template: WhatsAppTemplate }>
    >(`/api/v1/whatsapp-templates/${id}`, payload);
    return data.data.template;
  },

  /**
   * Soft-delete a WhatsApp template
   */
  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/v1/whatsapp-templates/${id}`);
  },
};
