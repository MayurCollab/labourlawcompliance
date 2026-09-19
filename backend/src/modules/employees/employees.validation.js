import { z } from 'zod';

import {
  objectIdListSchema,
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import { EMPLOYEE_SORTABLE_FIELDS } from './employees.constants.js';

const periodSchema = z
  .string({ error: 'Period is required' })
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM');

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === '' ? null : value));

const optionalAmount = z
  .preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.number().min(0, 'Cannot be negative').nullable(),
  )
  .optional();

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(20000).optional(),
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM')
    .optional(),
  clientId: objectIdSchema.optional(),
  clientIds: objectIdListSchema,
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

export const employeeLookupQuerySchema = z.object({
  employeeNo: z
    .string({ error: 'Employee No is required' })
    .trim()
    .min(1, 'Employee No is required')
    .max(64),
  clientId: objectIdSchema,
  period: periodSchema,
});

export const createEmployeeSchema = z.object({
  clientId: objectIdSchema,
  employeeNo: z
    .string({ error: 'Employee No is required' })
    .trim()
    .min(1, 'Employee No is required')
    .max(64, 'Employee No cannot exceed 64 characters'),
  employeeName: optionalText(200),
  period: periodSchema,
  periodLabel: optionalText(80),
  state: optionalText(80),
  ptGross: optionalAmount,
});

export const updateEmployeeSchema = z
  .object({
    clientId: objectIdSchema.optional(),
    employeeNo: z
      .string()
      .trim()
      .min(1, 'Employee No is required')
      .max(64, 'Employee No cannot exceed 64 characters')
      .optional(),
    employeeName: optionalText(200),
    period: periodSchema.optional(),
    periodLabel: optionalText(80),
    state: optionalText(80),
    ptGross: optionalAmount,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
