import { z } from 'zod';

import {
  booleanQuerySchema,
  objectIdListSchema,
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import { FILING_SORTABLE_FIELDS } from './filings.constants.js';

const periodSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM');

export const listFilingsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(20000).optional(),
  period: periodSchema.optional(),
  locationId: objectIdSchema.optional(),
  locationIds: objectIdListSchema,
  clientId: objectIdSchema.optional(),
  clientIds: objectIdListSchema,
  generateStatus: z.enum(['pending', 'generated', 'failed']).optional(),
  recentlyAdded: booleanQuerySchema,
  sortBy: z.enum(FILING_SORTABLE_FIELDS).default('period'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(10000).default(10),
});

export const downloadFilingQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
});

export const generateFilingBodySchema = z.object({
  computeIfNeeded: z.boolean().optional(),
});

export const updateFilingOverridesSchema = z.object({
  employerAddress: z.string().trim().max(500).nullable().optional(),
  signatoryName: z.string().trim().max(120).nullable().optional(),
  filingDate: z.union([z.string(), z.date()]).nullable().optional(),
  additionalTaxPayable: z.coerce.number().min(0).nullable().optional(),
});

export const bulkGenerateFilingsSchema = z
  .object({
    ids: z.array(objectIdSchema).max(200).optional(),
    period: periodSchema.optional(),
    locationId: objectIdSchema.optional(),
    locationIds: objectIdListSchema,
    clientId: objectIdSchema.optional(),
    clientIds: objectIdListSchema,
    generateStatus: z.enum(['pending', 'generated', 'failed']).optional(),
    search: z.string().trim().max(20000).optional(),
    recentlyAdded: booleanQuerySchema,
  })
  .superRefine((data, ctx) => {
    if (!(data.ids && data.ids.length > 0) && !data.period) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select rows or a month to generate',
        path: ['ids'],
      });
    }
  });

export const listPtMismatchesQuerySchema = z
  .object({
    ids: objectIdListSchema,
    period: periodSchema.optional(),
    locationId: objectIdSchema.optional(),
    locationIds: objectIdListSchema,
    clientId: objectIdSchema.optional(),
    clientIds: objectIdListSchema,
    generateStatus: z.enum(['pending', 'generated', 'failed']).optional(),
    search: z.string().trim().max(20000).optional(),
    recentlyAdded: booleanQuerySchema,
  })
  .superRefine((data, ctx) => {
    if (!(data.ids && data.ids.length > 0) && !data.period) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select rows or a month to check P.Tax',
        path: ['ids'],
      });
    }
  });

/**
 * Text the operator typed for the template's custom variables, keyed by
 * placeholder token (or slot index). Empty for templates that only use data fields.
 */
const customValuesSchema = z
  .record(z.string(), z.string().trim().max(1024))
  .optional();

export const bulkSendFilingWhatsAppSchema = z.object({
  ids: z.array(objectIdSchema).min(1, 'Select at least one filing').max(500),
  templateId: objectIdSchema,
  customValues: customValuesSchema,
});

export const sendFilingWhatsAppSchema = z.object({
  templateId: objectIdSchema,
  phone: z.string().trim().max(32).optional(),
  savePhone: z.boolean().optional(),
  recipientName: z.string().trim().max(120).optional(),
  saveRecipientName: z.boolean().optional(),
  customValues: customValuesSchema,
});
