import { z } from 'zod';

/**
 * Available field keys for template variable mapping.
 * Must match WHATSAPP_TEMPLATE_FIELDS from backend.
 */
const fieldKeys = [
  'recipientName',
  'companyName',
  'clientCode',
  'month',
  'year',
  'periodLabel',
  'signatoryName',
] as const;

/** Variable resolved from client / filing data. */
const fieldVariableSchema = z.object({
  type: z.literal('field'),
  field: z.enum(fieldKeys, { error: 'Invalid field selection' }),
});

/** Variable the operator fills in at send time. */
const customVariableSchema = z.object({
  type: z.literal('custom'),
  label: z
    .string({ error: 'Give the custom variable a label' })
    .trim()
    .min(1, 'Give the custom variable a label')
    .max(60, 'Label cannot exceed 60 characters'),
  token: z
    .string()
    .trim()
    .regex(/^\{\{[A-Za-z0-9_]+\}\}$/, 'Token must look like {{CustomText1}}'),
});

/**
 * Validation schema for creating/editing a WhatsApp template.
 *
 * No MSG91 template name/namespace/language here — the operator composing a
 * template doesn't manage that. Every template created through this form
 * targets the one MSG91-approved template a developer configured; the
 * backend fills in its identity when the payload has no msg91TemplateName.
 */
export const whatsappTemplateFormSchema = z.object({
  label: z
    .string({ error: 'Template name is required' })
    .trim()
    .min(1, 'Template name is required')
    .max(120, 'Template name cannot exceed 120 characters'),

  bodyPreview: z
    .string({ error: 'Message body is required' })
    .trim()
    .min(1, 'Message body is required')
    .max(2000, 'Message body cannot exceed 2000 characters'),

  variables: z
    .array(
      z.discriminatedUnion('type', [fieldVariableSchema, customVariableSchema]),
    )
    .min(1, 'At least one variable is required')
    .max(20, 'Cannot exceed 20 variables')
    .refine(
      (variables) => {
        const tokens = variables
          .filter((item) => item.type === 'custom')
          .map((item) => item.token);
        return new Set(tokens).size === tokens.length;
      },
      { message: 'Each custom variable needs its own placeholder token' },
    ),

  isActive: z.boolean().default(true).optional(),
});

export type WhatsAppTemplateFormValues = z.infer<
  typeof whatsappTemplateFormSchema
>;
