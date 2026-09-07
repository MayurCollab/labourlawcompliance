import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import validate from '../../middleware/validate.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as activityController from './activity.controller.js';
import { listActivityQuerySchema } from './activity.validation.js';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /activity:
 *   get:
 *     tags: [Activity]
 *     summary: List audit/activity records (read-only)
 *     description: >
 *       The activity log is append-only. There is no create, update or delete
 *       endpoint for it — not even for administrators — so the record stays
 *       trustworthy. Entries are written by the service layer as a side effect
 *       of the operations they describe.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 100 } }
 *       - { in: query, name: action, schema: { type: string }, description: 'Exact action (users.create) or a module prefix (uploads, filings)' }
 *       - { in: query, name: entityType, schema: { type: string, enum: [User, Role, Permission, Session, Client, Location, PtSlab, Settings, Upload, Filing, Employee, Template] } }
 *       - { in: query, name: entityId, schema: { type: string } }
 *       - { in: query, name: actorId, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Paginated activity entries
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       403:
 *         description: Missing activity.view
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.ACTIVITY_VIEW),
  validate({ query: listActivityQuerySchema }),
  activityController.listActivity,
);

export default router;
