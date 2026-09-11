import { z } from 'zod';

const optionalText = z.string().trim().max(200).optional();

export const clientFormSchema = z.object({
  clientCode: z
    .string({ error: 'Client code is required' })
    .trim()
    .min(1, 'Client code is required')
    .max(32, 'Client code cannot exceed 32 characters')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Use letters, numbers, hyphens and underscores only',
    ),
  companyName: z
    .string({ error: 'Company name is required' })
    .trim()
    .min(1, 'Company name is required')
    .max(200, 'Company name cannot exceed 200 characters'),
  locationName: z
    .string({ error: 'Location is required' })
    .trim()
    .min(1, 'Location is required')
    .max(100, 'Location name cannot exceed 100 characters'),
  draftName: optionalText,
  authorityName: optionalText,
  address: z.string().trim().max(500).optional(),
  rcNumber: z.string().trim().max(64).optional(),
  contactNumber: z.string().trim().max(32).optional(),
  recipientName: z.string().trim().max(120).optional(),
  fundCode: z.string().trim().max(32).optional(),
  phyCode: z.string().trim().max(32).optional(),
  status: z.string().trim().max(32).optional(),
  signatoryName: z.string().trim().max(120).optional(),
  includeEmployeesOnForm5: z.boolean().optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const ptSlabFormSchema = z
  .object({
    salaryFrom: z.coerce.number().int().min(0, 'Must be 0 or more'),
    salaryTo: z.string().trim(),
    rate: z.coerce.number().int().min(0, 'Must be 0 or more'),
    label: z.string().trim().max(80).optional(),
    effectiveFrom: z.string().min(1, 'Effective from is required'),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine(
    (data) => {
      if (data.salaryTo === '') return true;
      const to = Number(data.salaryTo);
      return Number.isFinite(to) && to >= data.salaryFrom;
    },
    { message: 'salaryTo must be ≥ salaryFrom (leave blank for “and above”)', path: ['salaryTo'] },
  );

export type PtSlabFormValues = z.infer<typeof ptSlabFormSchema>;

export const signatoryFormSchema = z.object({
  signatoryName: z.string().trim().max(120),
});

export type SignatoryFormValues = z.infer<typeof signatoryFormSchema>;
