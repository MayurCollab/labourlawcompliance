import {
  WHATSAPP_BODY_MODES,
  WHATSAPP_VARIABLE_TYPES,
} from './whatsappTemplates.constants.js';

/**
 * Variables stored before custom text existed have no `type`; send an explicit
 * one so the client can discriminate without repeating the default.
 */
const toVariableDto = (item) =>
  item.type === WHATSAPP_VARIABLE_TYPES.CUSTOM
    ? {
        type: WHATSAPP_VARIABLE_TYPES.CUSTOM,
        label: item.label ?? '',
        token: item.token ?? '',
      }
    : { type: WHATSAPP_VARIABLE_TYPES.FIELD, field: item.field };

export const toWhatsAppTemplateDto = (template) => ({
  id: template.id,
  label: template.label,
  msg91TemplateName: template.msg91TemplateName,
  namespace: template.namespace,
  languageCode: template.languageCode,
  bodyPreview: template.bodyPreview ?? '',
  bodyMode: template.bodyMode || WHATSAPP_BODY_MODES.POSITIONAL,
  variables: (template.variables || []).map(toVariableDto),
  isActive: template.isActive,
  isSeeded: template.isSeeded,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

export const toWhatsAppTemplateListDto = (templates) =>
  templates.map(toWhatsAppTemplateDto);
