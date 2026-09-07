import { z } from 'zod';

const dateSchema = z.coerce.date({ error: 'Invalid date' });

/**
 * Open-ended bands send `salaryTo: null` (“12,000 and above”).
 * `z.coerce.number()` must not run first — `Number(null)` is 0, which then
 * fails `salaryTo >= salaryFrom` on the top Gujarat slab.
 */
const salaryToSchema = z.preprocess((value) => {
  if (value === '' || value === null) return null;
  return value;
}, z.union([z.null(), z.coerce.number().int().min(0)]).optional());

export const listPtSlabsQuerySchema = z.object({
  at: dateSchema.optional(),
});

export const createPtSlabSchema = z
  .object({
    salaryFrom: z.coerce.number().int().min(0, 'salaryFrom cannot be negative'),
    salaryTo: salaryToSchema,
    rate: z.coerce.number().int().min(0, 'rate cannot be negative'),
    label: z.string().trim().max(80).optional(),
    effectiveFrom: dateSchema,
    effectiveTo: z.union([dateSchema, z.null()]).optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine(
    (data) =>
      data.salaryTo === undefined ||
      data.salaryTo === null ||
      data.salaryTo >= data.salaryFrom,
    { message: 'salaryTo must be greater than or equal to salaryFrom', path: ['salaryTo'] },
  );

export const updatePtSlabSchema = z
  .object({
    salaryFrom: z.coerce.number().int().min(0).optional(),
    salaryTo: salaryToSchema,
    rate: z.coerce.number().int().min(0).optional(),
    label: z.string().trim().max(80).optional(),
    effectiveFrom: dateSchema.optional(),
    effectiveTo: z.union([dateSchema, z.null()]).optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(
    (data) =>
      data.salaryTo === undefined ||
      data.salaryTo === null ||
      data.salaryFrom === undefined ||
      data.salaryTo >= data.salaryFrom,
    {
      message: 'salaryTo must be greater than or equal to salaryFrom',
      path: ['salaryTo'],
    },
  );
