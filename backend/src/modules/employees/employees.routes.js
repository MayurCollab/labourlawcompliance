import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as employeesController from './employees.controller.js';
import { listEmployeesQuerySchema } from './employees.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /employees:
 *   get:
 *     tags: [Employees]
 *     summary: List employee month snapshots from salary ingest
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: period, schema: { type: string }, description: YYYY-MM }
 *       - { in: query, name: unmatched, schema: { type: string, enum: [true, false] } }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_VIEW),
  validate({ query: listEmployeesQuerySchema }),
  employeesController.listEmployees,
);

export default router;
