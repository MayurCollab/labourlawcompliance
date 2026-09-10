import { z } from 'zod';

/**
 * Shared Zod building blocks reused by every module's validation file.
 */

export const objectIdSchema = z
  .string({ error: 'Id is required' })
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id format');

/**
 * Accepts repeated query keys, a CSV string, or a single id.
 * Returns undefined when empty.
 */
export const objectIdListSchema = z.preprocess((value) => {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}, z.array(objectIdSchema).max(500).optional());

export const idParamSchema = z.object({
  id: objectIdSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(10),
});

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number');

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Invalid email address' }));
