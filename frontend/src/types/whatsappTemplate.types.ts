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

/** Variable resolved from the client / filing record at send time. */
export type WhatsAppFieldVariable = {
  type: 'field';
  field: WhatsAppTemplateFieldKey;
};

/** Variable whose value the operator types when sending. */
export type WhatsAppCustomVariable = {
  type: 'custom';
  /** Admin-facing name for the input shown at send time, e.g. "Message text". */
  label: string;
  /** Placeholder written in the body, e.g. `{{CustomText1}}`. */
  token: string;
};

export type WhatsAppTemplateVariable =
  | WhatsAppFieldVariable
  | WhatsAppCustomVariable;

/**
 * Text typed for a template's custom variables, keyed by placeholder token.
 * Empty for templates that only use data fields.
 */
export type WhatsAppCustomValues = Record<string, string>;

/** How a template's variables reach MSG91 — see backend WHATSAPP_BODY_MODES. */
export type WhatsAppBodyMode = 'positional' | 'single';

export type WhatsAppTemplate = {
  id: string;
  label: string;
  msg91TemplateName: string;
  namespace: string;
  languageCode: string;
  bodyPreview: string;
  bodyMode: WhatsAppBodyMode;
  variables: WhatsAppTemplateVariable[];
  isActive: boolean;
  isSeeded?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppTemplateListItem = WhatsAppTemplate;

/**
 * msg91TemplateName/namespace/languageCode are omitted here — the "New
 * Template" form doesn't collect them, and their absence is what tells the
 * backend to target the one configured generic MSG91 template.
 */
export type CreateWhatsAppTemplatePayload = {
  label: string;
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

/**
 * Fixed wording MSG91 wraps around the one variable in the generic
 * ('single' mode) template on its own side — never sent by us, only shown so
 * the editor's preview matches what actually gets delivered.
 */
export type WhatsAppGenericTemplateWrapper = {
  prefix: string;
  suffix: string;
};

export type WhatsAppTemplateFieldsResult = {
  fields: WhatsAppTemplateField[];
  genericTemplate: WhatsAppGenericTemplateWrapper;
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
