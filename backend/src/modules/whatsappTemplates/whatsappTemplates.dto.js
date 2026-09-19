export const toWhatsAppTemplateDto = (template) => ({
  id: template.id,
  label: template.label,
  msg91TemplateName: template.msg91TemplateName,
  namespace: template.namespace,
  languageCode: template.languageCode,
  bodyPreview: template.bodyPreview ?? '',
  variables: (template.variables || []).map((item) => ({ field: item.field })),
  isActive: template.isActive,
  isSeeded: template.isSeeded,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

export const toWhatsAppTemplateListDto = (templates) =>
  templates.map(toWhatsAppTemplateDto);
