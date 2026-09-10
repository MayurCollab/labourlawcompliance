import { z } from 'zod';

import {
  objectIdListSchema,
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import { CLIENT_SORTABLE_FIELDS } from './clients.constants.js';

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === '' ? null : value));

export const listClientsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  locationId: objectIdSchema.optional(),
  locationIds: objectIdListSchema,
  fundCode: z.string().trim().max(32).optional(),
  sortBy: z.enum(CLIENT_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const exportClientsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  locationId: objectIdSchema.optional(),
  locationIds: objectIdListSchema,
  fundCode: z.string().trim().max(32).optional(),
  sortBy: z.enum(CLIENT_SORTABLE_FIELDS).default('clientCode'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createClientSchema = z.object({
  clientCode: z
    .string({ error: 'Client code is required' })
    .trim()
    .min(1, 'Client code is required')
    .max(32, 'Client code cannot exceed 32 characters')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Client code may only contain letters, numbers, hyphens and underscores',
    ),
  companyName: z
    .string({ error: 'Company name is required' })
    .trim()
    .min(1, 'Company name is required')
    .max(200, 'Company name cannot exceed 200 characters'),
  locationName: z
    .string({ error: 'Location is required' })
    .trim()
    .min(1, 'Location is required')
    .max(100, 'Location name cannot exceed 100 characters'),
  draftName: optionalText(200),
  authorityName: optionalText(200),
  address: optionalText(500),
  rcNumber: optionalText(64),
  contactNumber: optionalText(32),
  fundCode: optionalText(32),
  phyCode: optionalText(32),
  status: optionalText(32),
  signatoryName: optionalText(120),
  includeEmployeesOnForm5: z.boolean().optional(),
});

export const updateClientSchema = z
  .object({
    clientCode: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    companyName: z.string().trim().min(1).max(200).optional(),
    locationName: z.string().trim().min(1).max(100).optional(),
    draftName: optionalText(200),
    authorityName: optionalText(200),
    address: optionalText(500),
    rcNumber: optionalText(64),
    contactNumber: optionalText(32),
    fundCode: optionalText(32),
    phyCode: optionalText(32),
    status: optionalText(32),
    signatoryName: optionalText(120),
    includeEmployeesOnForm5: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
