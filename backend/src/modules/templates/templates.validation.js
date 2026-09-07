import { z } from 'zod';

import {
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import {
  ASSIGNMENT_SCOPES,
  TEMPLATE_SORTABLE_FIELDS,
} from './templates.constants.js';

const optionalBind = z
  .string()
  .trim()
  .max(80)
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value ?? null));

export const listTemplatesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(TEMPLATE_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().max(160).optional(),
  code: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z0-9-]*$/, 'Code may only contain lowercase letters, numbers and hyphens')
    .optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  mapping: z
    .object({
      scalars: z.record(z.string(), optionalBind),
      slabs: z.array(
        z.object({
          salaryFrom: z.number(),
          salaryTo: z.number().nullable().optional(),
          rate: z.number(),
          label: z.string().trim().max(80).optional(),
          binds: z.record(z.string(), optionalBind),
        }),
      ),
    })
    .optional(),
});

export const assignTemplateSchema = z
  .object({
    scope: z.enum([
      ASSIGNMENT_SCOPES.GLOBAL,
      ASSIGNMENT_SCOPES.LOCATION,
      ASSIGNMENT_SCOPES.CLIENT,
    ]),
    locationId: objectIdSchema.optional(),
    clientId: objectIdSchema.optional(),
    clear: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scope === ASSIGNMENT_SCOPES.LOCATION && !data.locationId) {
      ctx.addIssue({
        code: 'custom',
        message: 'locationId is required for a location assignment',
        path: ['locationId'],
      });
    }
    if (data.scope === ASSIGNMENT_SCOPES.CLIENT && !data.clientId) {
      ctx.addIssue({
        code: 'custom',
        message: 'clientId is required for a client assignment',
        path: ['clientId'],
      });
    }
  });

export const resolveTemplateQuerySchema = z.object({
  clientId: objectIdSchema,
});

export const bundledTemplateCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^form5-[a-z0-9-]+$/, 'Invalid bundled template code'),
});
