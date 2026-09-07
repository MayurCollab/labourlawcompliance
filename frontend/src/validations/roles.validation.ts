import { z } from 'zod';

export const roleFormSchema = z.object({
  name: z
    .string({ error: 'Role name is required' })
    .trim()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name cannot exceed 50 characters'),
  description: z.string().trim().max(200).optional(),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;
