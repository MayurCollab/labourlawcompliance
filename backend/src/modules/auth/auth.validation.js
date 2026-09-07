import { z } from 'zod';

import {
  emailSchema,
  passwordSchema,
} from '../../validations/common.validation.js';

/**
 * Zod schemas for every auth endpoint — used with middleware/validate.js:
 *   validate({ body: registerSchema })
 */

export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: emailSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string({ error: 'Verification token is required' }).min(1),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required' }).min(1),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: 'Reset token is required' }).min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });
