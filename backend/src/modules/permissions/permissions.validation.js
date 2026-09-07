import { z } from 'zod';

/**
 * Permission names follow `<module>.<action>` (e.g. "users.create").
 * The module segment is derived from the name in the service layer.
 */
const permissionNameSchema = z
  .string({ error: 'Permission name is required' })
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z-]*\.[a-z][a-z-]*$/,
    'Permission name must look like "module.action" (e.g. "users.create")',
  );

export const createPermissionSchema = z.object({
  name: permissionNameSchema,
  description: z.string().trim().max(200).optional(),
});

export const updatePermissionSchema = z
  .object({
    name: permissionNameSchema.optional(),
    description: z.string().trim().max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listPermissionsQuerySchema = z.object({
  grouped: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
