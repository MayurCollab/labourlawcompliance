import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as rolesController from './roles.controller.js';
import {
  assignUsersSchema,
  createRoleSchema,
  updateRolePermissionsSchema,
  updateRoleSchema,
} from './roles.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: List roles (with populated permissions)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Role list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       403:
 *         description: Missing roles.view
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.ROLES_VIEW),
  rolesController.listRoles,
);

/**
 * @openapi
 * /roles/{id}:
 *   get:
 *     tags: [Roles]
 *     summary: Get a role by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.ROLES_VIEW),
  validate({ params: idParamSchema }),
  rolesController.getRole,
);

/**
 * @openapi
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Create a role
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Manager }
 *               description: { type: string }
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *                 description: Permission ids
 *     responses:
 *       201:
 *         description: Role created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       409:
 *         description: Role name already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.ROLES_CREATE),
  validate({ body: createRoleSchema }),
  rolesController.createRole,
);

/**
 * @openapi
 * /roles/{id}:
 *   patch:
 *     tags: [Roles]
 *     summary: Update a role (system roles cannot be renamed)
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
 *         description: Role updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.ROLES_EDIT),
  validate({ params: idParamSchema, body: updateRoleSchema }),
  rolesController.updateRole,
);

/**
 * @openapi
 * /roles/{id}:
 *   delete:
 *     tags: [Roles]
 *     summary: Delete a role (blocked for system roles and roles in use)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: System role protected
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Users still assigned to this role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.ROLES_DELETE),
  validate({ params: idParamSchema }),
  rolesController.deleteRole,
);

/**
 * @openapi
 * /roles/{id}/permissions:
 *   patch:
 *     tags: [Roles]
 *     summary: Replace a role's permission set
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
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *                 description: Full replacement list of permission ids
 *     responses:
 *       200:
 *         description: Permission set updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: One or more permission ids invalid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch(
  '/:id/permissions',
  checkPermission(PERMISSION_NAMES.ROLES_EDIT),
  validate({ params: idParamSchema, body: updateRolePermissionsSchema }),
  rolesController.updateRolePermissions,
);

/**
 * @openapi
 * /roles/{id}/assign-users:
 *   post:
 *     tags: [Roles]
 *     summary: Assign users to this role
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
 *             required: [userIds]
 *             properties:
 *               userIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Users assigned — data.assignedCount reports how many changed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post(
  '/:id/assign-users',
  checkPermission(PERMISSION_NAMES.ROLES_EDIT),
  validate({ params: idParamSchema, body: assignUsersSchema }),
  rolesController.assignUsersToRole,
);

export default router;
