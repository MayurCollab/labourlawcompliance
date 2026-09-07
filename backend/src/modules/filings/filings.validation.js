import { z } from 'zod';

import {
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import { FILING_SORTABLE_FIELDS } from './filings.constants.js';

const periodSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM');

export const listFilingsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().max(100).optional(),
    period: periodSchema.optional(),
    locationId: objectIdSchema.optional(),
    clientId: objectIdSchema.optional(),
    generateStatus: z.enum(['pending', 'generated', 'failed']).optional(),
    sortBy: z.enum(FILING_SORTABLE_FIELDS).default('period'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
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
    clientId: objectIdSchema.optional(),
    generateStatus: z.enum(['pending', 'generated', 'failed']).optional(),
    search: z.string().trim().max(100).optional(),
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
