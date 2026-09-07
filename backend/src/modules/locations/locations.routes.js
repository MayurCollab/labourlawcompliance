import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as locationsController from './locations.controller.js';
import {
  createLocationSchema,
  updateLocationSchema,
} from './locations.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /locations:
 *   get:
 *     tags: [Locations]
 *     summary: List locations
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  locationsController.listLocations,
);

/**
 * @openapi
 * /locations:
 *   post:
 *     tags: [Locations]
 *     summary: Create a location
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_CREATE),
  validate({ body: createLocationSchema }),
  locationsController.createLocation,
);

/**
 * @openapi
 * /locations/{id}:
 *   get:
 *     tags: [Locations]
 *     summary: Get a location by id
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  validate({ params: idParamSchema }),
  locationsController.getLocation,
);

/**
 * @openapi
 * /locations/{id}:
 *   patch:
 *     tags: [Locations]
 *     summary: Rename a location
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_EDIT),
  validate({ params: idParamSchema, body: updateLocationSchema }),
  locationsController.updateLocation,
);

/**
 * @openapi
 * /locations/{id}:
 *   delete:
 *     tags: [Locations]
 *     summary: Soft-delete a location (blocked if clients still use it)
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_DELETE),
  validate({ params: idParamSchema }),
  locationsController.deleteLocation,
);

export default router;
