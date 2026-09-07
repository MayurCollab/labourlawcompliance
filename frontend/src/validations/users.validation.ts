import { z } from 'zod';

import {
  emailSchema,
  passwordSchema,
} from '@/validations/auth.validation';

const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name cannot exceed 100 characters');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{5,20}$/, 'Invalid phone number')
  .or(z.literal(''))
  .optional();

export const createUserFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateUserFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  role: z.string().optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>;
