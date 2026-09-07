import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z
    .string({ error: 'Location name is required' })
    .trim()
    .min(1, 'Location name is required')
    .max(100, 'Location name cannot exceed 100 characters'),
});

export const updateLocationSchema = z.object({
  name: z
    .string({ error: 'Location name is required' })
    .trim()
    .min(1, 'Location name is required')
    .max(100, 'Location name cannot exceed 100 characters'),
});
