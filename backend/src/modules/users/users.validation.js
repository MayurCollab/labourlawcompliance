import { z } from 'zod';

import {
  emailSchema,
  objectIdSchema,
  paginationQuerySchema,
  passwordSchema,
} from '../../validations/common.validation.js';
import { USER_SORTABLE_FIELDS } from './users.constants.js';

const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name cannot exceed 100 characters');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{5,20}$/, 'Invalid phone number')
  .nullable();

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  role: objectIdSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(USER_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: objectIdSchema.optional(),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    role: objectIdSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ error: 'isActive (boolean) is required' }),
});

/** Self-service erasure is irreversible, so re-authenticate with the password. */
export const eraseMyAccountSchema = z.object({
  password: z.string({ error: 'Your current password is required' }).min(1),
  confirm: z.literal('DELETE MY ACCOUNT', {
    error: 'Type "DELETE MY ACCOUNT" to confirm',
  }),
});

// .default({}) so an admin can call the endpoint with no body at all
export const eraseUserSchema = z
  .object({
    reason: z.string().trim().max(200).optional(),
  })
  .default({});

export const updateMyProfileSchema = z
  .object({
    name: nameSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
