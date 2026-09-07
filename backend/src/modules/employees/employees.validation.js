import { z } from 'zod';

import {
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import { EMPLOYEE_SORTABLE_FIELDS } from './employees.constants.js';

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM')
    .optional(),
  clientId: objectIdSchema.optional(),
  phyCode: z.string().trim().max(32).optional(),
  unmatched: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return undefined;
    }),
  sortBy: z.enum(EMPLOYEE_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
