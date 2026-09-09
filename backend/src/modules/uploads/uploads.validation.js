import { z } from 'zod';

import { paginationQuerySchema } from '../../validations/common.validation.js';
import {
  UPLOAD_KINDS,
  UPLOAD_SORTABLE_FIELDS,
} from './uploads.constants.js';

const kindSchema = z.enum([
  UPLOAD_KINDS.MASTER,
  UPLOAD_KINDS.SALARY,
  UPLOAD_KINDS.CLIENT_MASTER,
]);

export const createUploadSchema = z.object({
  kind: kindSchema.default(UPLOAD_KINDS.MASTER),
});

export const listUploadsQuerySchema = paginationQuerySchema.extend({
  kind: kindSchema.optional(),
  sortBy: z.enum(UPLOAD_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const previewUploadSchema = z.object({
  sheetName: z
    .string({ error: 'Sheet name is required' })
    .trim()
    .min(1, 'Sheet name is required')
    .max(31, 'Sheet name cannot exceed 31 characters'),
});

export const importUploadSchema = z.object({
  sheetName: z.string().trim().min(1).max(31).optional(),
  mapping: z.record(z.string(), z.number().int().min(0).nullable()),
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM')
    .optional(),
  companyName: z.string().trim().max(200).optional().nullable(),
});

export const listUploadRowsSchema = z.object({
  sheetName: z.string().trim().min(1).max(31).optional(),
  mapping: z
    .record(z.string(), z.number().int().min(0).nullable())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(50),
  companyName: z.string().trim().max(200).optional().nullable(),
});

const confirmationSchema = z
  .string()
  .trim()
  .min(1, 'Confirmation phrase is required');

export const purgeMasterSchema = z.object({
  confirmation: confirmationSchema,
});

export const purgeSalarySchema = z.object({
  confirmation: confirmationSchema,
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  companyName: z.string().trim().max(200).optional().nullable(),
});

export const purgeClientMasterSchema = z.object({
  confirmation: confirmationSchema,
});
