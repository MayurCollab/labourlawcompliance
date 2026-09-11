import { z } from 'zod';

import {
  objectIdListSchema,
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import {
  WHATSAPP_SEND_SORTABLE_FIELDS,
  WHATSAPP_SEND_STATUS_VALUES,
} from './whatsappSends.constants.js';

export const listWhatsAppSendsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM')
    .optional(),
  clientId: objectIdSchema.optional(),
  clientIds: objectIdListSchema,
  locationId: objectIdSchema.optional(),
  locationIds: objectIdListSchema,
  status: z.enum(WHATSAPP_SEND_STATUS_VALUES).optional(),
  phone: z.string().trim().max(20).optional(),
  sortBy: z.enum(WHATSAPP_SEND_SORTABLE_FIELDS).default('sentAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
