import config from '../../config/index.js';
import AppError from '../../utils/AppError.js';
import { escapeRegex } from '../../utils/searchTokens.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import {
  WHATSAPP_BODY_MODES,
  WHATSAPP_TEMPLATE_FIELDS,
  WHATSAPP_TEMPLATES_CODES,
} from './whatsappTemplates.constants.js';
import {
  toWhatsAppTemplateDto,
  toWhatsAppTemplateListDto,
} from './whatsappTemplates.dto.js';
import * as whatsappTemplatesRepository from './whatsappTemplates.repository.js';

const findTemplateOrFail = async (id) => {
  const template = await whatsappTemplatesRepository.findWhatsAppTemplateById(id);
  if (!template) {
    throw new AppError('WhatsApp template not found.', 404, {
      code: WHATSAPP_TEMPLATES_CODES.TEMPLATE_NOT_FOUND,
    });
  }
  return template;
};

/** Load a template for sending; it must exist and be active. */
export const getActiveTemplateOrFail = async (id) => {
  const template = await findTemplateOrFail(id);
  if (!template.isActive) {
    throw new AppError('This WhatsApp template is inactive.', 400, {
      code: WHATSAPP_TEMPLATES_CODES.TEMPLATE_INACTIVE,
    });
  }
  return template;
};

/**
 * Field definitions plus the generic MSG91 template's fixed wrapper text —
 * the frontend can't read .env, and needs the prefix/suffix to show the
 * operator what a 'single' mode template actually looks like once MSG91
 * wraps it, without ever letting them type "Hii"/"Thank you" themselves.
 */
export const listTemplateFields = () => ({
  fields: WHATSAPP_TEMPLATE_FIELDS,
  genericTemplate: {
    prefix: config.msg91.genericTemplate.prefix,
    suffix: config.msg91.genericTemplate.suffix,
  },
});

export const listWhatsAppTemplates = async (query) => {
  const { page, limit, search, isActive, sortBy, sortOrder } = query;

  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ label: regex }, { msg91TemplateName: regex }];
  }
  if (isActive !== undefined) filter.isActive = isActive;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [templates, total] = await Promise.all([
    whatsappTemplatesRepository.findWhatsAppTemplates(filter, {
      sort,
      skip,
      limit,
    }),
    whatsappTemplatesRepository.countWhatsAppTemplates(filter),
  ]);

  return {
    templates: toWhatsAppTemplateListDto(templates),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getWhatsAppTemplate = async (id) =>
  toWhatsAppTemplateDto(await findTemplateOrFail(id));

/**
 * The "New Template" UI never sends msg91TemplateName/namespace — every
 * template it creates targets the one MSG91-approved template with a single
 * variable slot, configured once by a developer (config.msg91.genericTemplate).
 * An explicit msg91TemplateName (not reachable from that UI) is honored as
 * given and resolves positionally instead, matching how Template 1 works.
 */
const resolveMsg91Target = (data) => {
  if (data.msg91TemplateName) {
    return {
      msg91TemplateName: data.msg91TemplateName,
      namespace: data.namespace,
      languageCode: data.languageCode,
      bodyMode: WHATSAPP_BODY_MODES.POSITIONAL,
    };
  }

  const generic = config.msg91.genericTemplate;
  if (!generic.name || !generic.namespace) {
    throw new AppError(
      'The generic MSG91 template is not configured. Set MSG91_GENERIC_TEMPLATE_NAME and MSG91_GENERIC_TEMPLATE_NAMESPACE in the backend environment before creating a template.',
      500,
      { code: WHATSAPP_TEMPLATES_CODES.GENERIC_TEMPLATE_NOT_CONFIGURED },
    );
  }

  return {
    msg91TemplateName: generic.name,
    namespace: generic.namespace,
    languageCode: generic.language,
    bodyMode: WHATSAPP_BODY_MODES.SINGLE,
  };
};

export const createWhatsAppTemplate = async (data, actorId) => {
  const target = resolveMsg91Target(data);

  const template = await whatsappTemplatesRepository.createWhatsAppTemplate({
    label: sanitizeUserHtml(data.label),
    ...target,
    bodyPreview: sanitizeUserHtml(data.bodyPreview),
    variables: data.variables,
    isActive: data.isActive,
    createdBy: actorId,
  });

  await recordActivity({
    action: ACTIVITY_ACTIONS.WHATSAPP_TEMPLATE_CREATE,
    entityType: ENTITY_TYPES.WHATSAPP_TEMPLATE,
    entityId: template.id,
    changes: {
      label: template.label,
      msg91TemplateName: template.msg91TemplateName,
      variables: template.variables.length,
    },
  });

  return toWhatsAppTemplateDto(template);
};

export const updateWhatsAppTemplate = async (id, data, actorId) => {
  const template = await findTemplateOrFail(id);

  if (data.label !== undefined) template.label = sanitizeUserHtml(data.label);
  if (data.msg91TemplateName !== undefined) {
    template.msg91TemplateName = data.msg91TemplateName;
  }
  if (data.namespace !== undefined) template.namespace = data.namespace;
  if (data.languageCode !== undefined) template.languageCode = data.languageCode;
  if (data.bodyPreview !== undefined) {
    template.bodyPreview = sanitizeUserHtml(data.bodyPreview);
  }
  if (data.variables !== undefined) template.variables = data.variables;
  if (data.isActive !== undefined) template.isActive = data.isActive;

  template.updatedBy = actorId;
  await whatsappTemplatesRepository.saveWhatsAppTemplate(template);

  await recordActivity({
    action: ACTIVITY_ACTIONS.WHATSAPP_TEMPLATE_UPDATE,
    entityType: ENTITY_TYPES.WHATSAPP_TEMPLATE,
    entityId: template.id,
    changes: {
      label: template.label,
      msg91TemplateName: template.msg91TemplateName,
      isActive: template.isActive,
    },
  });

  return toWhatsAppTemplateDto(template);
};

export const deleteWhatsAppTemplate = async (id, actorId) => {
  const template = await findTemplateOrFail(id);
  await template.softDelete(actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.WHATSAPP_TEMPLATE_SOFT_DELETE,
    entityType: ENTITY_TYPES.WHATSAPP_TEMPLATE,
    entityId: template.id,
    changes: { label: template.label },
  });
};
