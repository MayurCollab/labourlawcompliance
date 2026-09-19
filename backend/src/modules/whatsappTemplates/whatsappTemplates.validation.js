import { z } from 'zod';

import {
  booleanQuerySchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import {
  WHATSAPP_TEMPLATE_FIELD_KEYS,
  WHATSAPP_TEMPLATE_SORTABLE_FIELDS,
} from './whatsappTemplates.constants.js';

const variablesSchema = z
  .array(z.object({ field: z.enum(WHATSAPP_TEMPLATE_FIELD_KEYS) }))
  .min(1, 'Add at least one variable')
  .max(20, 'A template cannot have more than 20 variables');

const noSpaces = (label) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(120)
    .regex(/^\S+$/, `${label} cannot contain spaces`);

const baseShape = {
  label: z.string().trim().min(1, 'Label is required').max(120),
  msg91TemplateName: noSpaces('MSG91 template name'),
  namespace: noSpaces('Namespace'),
  languageCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}([_-][A-Za-z]{2,4})?$/, 'Invalid language code')
    .default('en'),
  bodyPreview: z.string().trim().max(1024).default(''),
  variables: variablesSchema,
  isActive: z.boolean().default(true),
};

export const listWhatsAppTemplatesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  isActive: booleanQuerySchema,
  sortBy: z.enum(WHATSAPP_TEMPLATE_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
});

export const createWhatsAppTemplateSchema = z.object(baseShape);

export const updateWhatsAppTemplateSchema = z
  .object({
    label: baseShape.label.optional(),
    msg91TemplateName: baseShape.msg91TemplateName.optional(),
    namespace: baseShape.namespace.optional(),
    languageCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2,3}([_-][A-Za-z]{2,4})?$/, 'Invalid language code')
      .optional(),
    bodyPreview: z.string().trim().max(1024).optional(),
    variables: variablesSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
