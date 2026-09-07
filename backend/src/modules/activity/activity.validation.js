import { z } from 'zod';

import {
  objectIdSchema,
  paginationQuerySchema,
} from '../../validations/common.validation.js';
import { ENTITY_TYPES } from './activity.constants.js';

const ENTITY_TYPE_VALUES = /** @type {[string, ...string[]]} */ (
  Object.values(ENTITY_TYPES)
);

export const listActivityQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(60).optional(),
  entityType: z.enum(ENTITY_TYPE_VALUES).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorId: objectIdSchema.optional(),
});
