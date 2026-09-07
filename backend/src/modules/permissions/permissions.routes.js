import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import * as permissionsController from './permissions.controller.js';
import { PERMISSION_NAMES } from './permissions.constants.js';
import {
  createPermissionSchema,
  listPermissionsQuerySchema,
  updatePermissionSchema,
} from './permissions.validation.js';

const router = Router();

// Every permissions endpoint requires authentication
router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: List permissions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: grouped
 *         schema: { type: boolean }
 *         description: When true, permissions are grouped by module
 *     responses:
 *       200:
 *         description: Permission list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       403:
 *         description: Missing permissions.view
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.PERMISSIONS_VIEW),
  validate({ query: listPermissionsQuerySchema }),
  permissionsController.listPermissions,
);

/**
 * @openapi
 * /permissions:
 *   post:
 *     tags: [Permissions]
 *     summary: Create a permission
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: reports.view }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Permission created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       409:
 *         description: Permission name already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.PERMISSIONS_CREATE),
  validate({ body: createPermissionSchema }),
  permissionsController.createPermission,
);

/**
 * @openapi
 * /permissions/{id}:
 *   patch:
 *     tags: [Permissions]
 *     summary: Update a permission
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Permission updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Permission not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.PERMISSIONS_EDIT),
  validate({ params: idParamSchema, body: updatePermissionSchema }),
  permissionsController.updatePermission,
);

/**
 * @openapi
 * /permissions/{id}:
 *   delete:
 *     tags: [Permissions]
 *     summary: Delete a permission (also removed from all roles)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Permission not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.PERMISSIONS_DELETE),
  validate({ params: idParamSchema }),
  permissionsController.deletePermission,
);

export default router;
