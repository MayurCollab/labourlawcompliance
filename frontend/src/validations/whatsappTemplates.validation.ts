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

/**
 * Validation schema for creating/editing a WhatsApp template
 */
export const whatsappTemplateFormSchema = z.object({
  label: z
    .string({ required_error: 'Template name is required' })
    .trim()
    .min(1, 'Template name is required')
    .max(120, 'Template name cannot exceed 120 characters'),

  msg91TemplateName: z
    .string({ required_error: 'MSG91 template name is required' })
    .trim()
    .min(1, 'MSG91 template name is required')
    .max(120, 'MSG91 template name cannot exceed 120 characters'),

  namespace: z
    .string({ required_error: 'Namespace is required' })
    .trim()
    .min(1, 'Namespace is required')
    .max(120, 'Namespace cannot exceed 120 characters'),

  languageCode: z
    .string()
    .trim()
    .max(10, 'Language code cannot exceed 10 characters')
    .default('en')
    .optional(),

  bodyPreview: z
    .string({ required_error: 'Message body is required' })
    .trim()
    .min(1, 'Message body is required')
    .max(2000, 'Message body cannot exceed 2000 characters'),

  variables: z
    .array(
      z.object({
        field: z.enum(fieldKeys, {
          errorMap: () => ({ message: 'Invalid field selection' }),
        }),
      }),
    )
    .min(1, 'At least one variable is required')
    .max(20, 'Cannot exceed 20 variables'),

  isActive: z.boolean().default(true).optional(),
});

export type WhatsAppTemplateFormValues = z.infer<
  typeof whatsappTemplateFormSchema
>;
