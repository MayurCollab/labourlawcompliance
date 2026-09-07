import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import { uploadImage } from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as usersController from './users.controller.js';
import {
  createUserSchema,
  eraseMyAccountSchema,
  eraseUserSchema,
  listUsersQuerySchema,
  updateMyProfileSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from './users.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

// ---------- Own profile (no special permission — any authenticated user) ----------

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get my profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user's profile
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/me', usersController.getMyProfile);

/**
 * @openapi
 * /users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Update my profile (name, phone)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.patch(
  '/me',
  validate({ body: updateMyProfileSchema }),
  usersController.updateMyProfile,
);

/**
 * @openapi
 * /users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload my profile picture
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: JPEG/PNG/WEBP/GIF, max 2 MB
 *     responses:
 *       200:
 *         description: Avatar updated — data.user.avatar holds the public path
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       422:
 *         description: Missing file or unsupported type
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/me/avatar', uploadImage('avatar'), usersController.updateMyAvatar);

// ---------- Data compliance (own data — no special permission) ----------

/**
 * @openapi
 * /users/me/export:
 *   get:
 *     tags: [Users]
 *     summary: Download my data as JSON
 *     description: >
 *       Exports everything the system holds about the calling user — profile,
 *       active session metadata, email send log and their own activity
 *       entries — as a JSON file attachment. Secrets (password hash, refresh
 *       token hashes) are never included.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: JSON export file
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.get('/me/export', usersController.exportMyData);

/**
 * @openapi
 * /users/me:
 *   delete:
 *     tags: [Users]
 *     summary: Permanently erase my account and data (irreversible)
 *     description: >
 *       Hard delete, not the soft delete used by `DELETE /users/{id}`. Removes
 *       the user row, every refresh token and every email log naming the
 *       address, and deletes the avatar file. Requires the current password
 *       plus an explicit confirmation phrase. Append-only activity records are
 *       retained — see README, "Soft delete vs. erasure".
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, confirm]
 *             properties:
 *               password: { type: string, format: password }
 *               confirm: { type: string, enum: ['DELETE MY ACCOUNT'] }
 *     responses:
 *       200:
 *         description: Account erased; session cookies cleared
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401:
 *         description: Password incorrect
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete(
  '/me',
  validate({ body: eraseMyAccountSchema }),
  usersController.eraseMyAccount,
);

// ---------- Admin CRUD (permission-guarded) ----------

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (pagination, search, filter, sort)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 100 } }
 *       - { in: query, name: search, schema: { type: string }, description: Matches name or email }
 *       - { in: query, name: role, schema: { type: string }, description: Role id }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [name, email, createdAt, updatedAt] } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc] } }
 *     responses:
 *       200:
 *         description: Paginated user list — data contains users[] and pagination
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       403:
 *         description: Missing users.view
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.USERS_VIEW),
  validate({ query: listUsersQuerySchema }),
  usersController.listUsers,
);

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a user (admin — account is pre-verified)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               phone: { type: string }
 *               role: { type: string, description: Role id }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.USERS_CREATE),
  validate({ body: createUserSchema }),
  usersController.createUser,
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.USERS_VIEW),
  validate({ params: idParamSchema }),
  usersController.getUser,
);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user (name, email, phone, role)
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
 *               email: { type: string, format: email }
 *               phone: { type: string, nullable: true }
 *               role: { type: string, nullable: true, description: Role id }
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.USERS_EDIT),
  validate({ params: idParamSchema, body: updateUserSchema }),
  usersController.updateUser,
);

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Activate or deactivate a user (cannot target yourself)
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
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: Cannot change your own status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch(
  '/:id/status',
  checkPermission(PERMISSION_NAMES.USERS_EDIT),
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  usersController.setUserStatus,
);

/**
 * @openapi
 * /users/{id}/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload a user's profile picture (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.post(
  '/:id/avatar',
  checkPermission(PERMISSION_NAMES.USERS_EDIT),
  validate({ params: idParamSchema }),
  uploadImage('avatar'),
  usersController.updateUserAvatar,
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (cannot target yourself)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.USERS_DELETE),
  validate({ params: idParamSchema }),
  usersController.deleteUser,
);

/**
 * @openapi
 * /users/{id}/erase:
 *   delete:
 *     tags: [Users]
 *     summary: Permanently erase a user (irreversible, admin)
 *     description: >
 *       Distinct from `DELETE /users/{id}`, which only soft-deletes. This
 *       removes the row and the user's personal data outright and requires the
 *       separate `users.erase` permission. Use it to service an erasure
 *       request, not for routine offboarding.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: Recorded in the activity log }
 *     responses:
 *       200:
 *         description: User erased
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       403:
 *         description: Missing users.erase
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete(
  '/:id/erase',
  checkPermission(PERMISSION_NAMES.USERS_ERASE),
  validate({ params: idParamSchema, body: eraseUserSchema }),
  usersController.eraseUser,
);

export default router;
