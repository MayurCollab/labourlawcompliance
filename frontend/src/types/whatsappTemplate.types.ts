export type WhatsAppTemplateFieldKey =
  | 'recipientName'
  | 'companyName'
  | 'clientCode'
  | 'month'
  | 'year'
  | 'periodLabel'
  | 'signatoryName';

export type WhatsAppTemplateField = {
  field: WhatsAppTemplateFieldKey;
  token: string;
  label: string;
  sample: string;
};

export type WhatsAppTemplateVariable = {
  field: WhatsAppTemplateFieldKey;
};

export type WhatsAppTemplate = {
  id: string;
  label: string;
  msg91TemplateName: string;
  namespace: string;
  languageCode: string;
  bodyPreview: string;
  variables: WhatsAppTemplateVariable[];
  isActive: boolean;
  isSeeded?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppTemplateListItem = WhatsAppTemplate;

export type CreateWhatsAppTemplatePayload = {
  label: string;
  msg91TemplateName: string;
  namespace: string;
  languageCode?: string;
  bodyPreview: string;
  variables: WhatsAppTemplateVariable[];
  isActive?: boolean;
};

export type UpdateWhatsAppTemplatePayload = Partial<CreateWhatsAppTemplatePayload>;

export type ListWhatsAppTemplatesParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'label' | 'msg91TemplateName' | 'isActive' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListWhatsAppTemplatesResult = {
  templates: WhatsAppTemplateListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type WhatsAppTemplateFieldsResult = {
  fields: WhatsAppTemplateField[];
};

// For the preview utilities
export type WhatsAppSourceData = {
  recipientName: string;
  companyName: string;
  clientCode: string;
  month: string;
  year: string;
  periodLabel: string;
  signatoryName: string;
};
