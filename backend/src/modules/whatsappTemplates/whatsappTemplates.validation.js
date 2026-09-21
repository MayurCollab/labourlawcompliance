import { z } from 'zod';

import {
  booleanQuerySchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import {
  CUSTOM_TOKEN_REGEX,
  WHATSAPP_TEMPLATE_FIELD_KEYS,
  WHATSAPP_TEMPLATE_SORTABLE_FIELDS,
  WHATSAPP_VARIABLE_TYPES,
} from './whatsappTemplates.constants.js';

/** Data-bound variable — resolved from the client / filing record at send time. */
const fieldVariableSchema = z.object({
  type: z.literal(WHATSAPP_VARIABLE_TYPES.FIELD).default(WHATSAPP_VARIABLE_TYPES.FIELD),
  field: z.enum(WHATSAPP_TEMPLATE_FIELD_KEYS),
});

/** Free-text variable — the operator types its value when sending. */
const customVariableSchema = z.object({
  type: z.literal(WHATSAPP_VARIABLE_TYPES.CUSTOM),
  label: z
    .string()
    .trim()
    .min(1, 'Give the custom variable a label')
    .max(60, 'Label cannot exceed 60 characters'),
  token: z
    .string()
    .trim()
    .regex(CUSTOM_TOKEN_REGEX, 'Custom variable token must look like {{CustomText1}}'),
});

/**
 * Entries stored before custom text existed have no `type`, so default it to
 * 'field' before discriminating. Keeps existing templates (and older clients)
 * valid without a migration.
 */
const variableSchema = z
  .preprocess(
    (value) =>
      value && typeof value === 'object' && !Array.isArray(value) && !('type' in value)
        ? { ...value, type: WHATSAPP_VARIABLE_TYPES.FIELD }
        : value,
    z.discriminatedUnion('type', [fieldVariableSchema, customVariableSchema]),
  );

const variablesSchema = z
  .array(variableSchema)
  .min(1, 'Add at least one variable')
  .max(20, 'A template cannot have more than 20 variables')
  .refine(
    (variables) => {
      const tokens = variables
        .filter((item) => item.type === WHATSAPP_VARIABLE_TYPES.CUSTOM)
        .map((item) => item.token);
      return new Set(tokens).size === tokens.length;
    },
    { message: 'Each custom variable needs its own placeholder token' },
  );

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

/**
 * The app's "New Template" UI never sends msg91TemplateName/namespace — every
 * template it creates targets the one configured generic MSG91 template (see
 * config.msg91.genericTemplate), filled in by the service. Both stay optional
 * here only so an explicit override is still possible; a half-given pair
 * (one but not the other) is rejected as ambiguous.
 */
export const createWhatsAppTemplateSchema = z
  .object({
    ...baseShape,
    msg91TemplateName: baseShape.msg91TemplateName.optional(),
    namespace: baseShape.namespace.optional(),
  })
  .refine(
    (data) => Boolean(data.msg91TemplateName) === Boolean(data.namespace),
    {
      message: 'Provide both msg91TemplateName and namespace, or neither',
      path: ['namespace'],
    },
  );

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
