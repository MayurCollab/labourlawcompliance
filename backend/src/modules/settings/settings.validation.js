import { z } from 'zod';

export const updateSettingsSchema = z.object({
  signatoryName: z
    .string()
    .trim()
    .max(120, 'Signatory name cannot exceed 120 characters'),
});
