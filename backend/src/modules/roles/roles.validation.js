import { z } from 'zod';

import { objectIdSchema } from '../../validations/common.validation.js';

export const createRoleSchema = z.object({
  name: z
    .string({ error: 'Role name is required' })
    .trim()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name cannot exceed 50 characters'),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(objectIdSchema).optional(),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(50).optional(),
    description: z.string().trim().max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(objectIdSchema, {
    error: 'permissions must be an array of permission ids',
  }),
});

export const assignUsersSchema = z.object({
  userIds: z
    .array(objectIdSchema, { error: 'userIds must be an array of user ids' })
    .min(1, 'At least one user id is required'),
});
