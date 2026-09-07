import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as ptSlabsController from './ptSlabs.controller.js';
import {
  createPtSlabSchema,
  listPtSlabsQuerySchema,
  updatePtSlabSchema,
} from './ptSlabs.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /pt-slabs:
 *   get:
 *     tags: [PT Slabs]
 *     summary: List currently effective PT slabs
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: at, schema: { type: string, format: date } }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  validate({ query: listPtSlabsQuerySchema }),
  ptSlabsController.listPtSlabs,
);

/**
 * @openapi
 * /pt-slabs:
 *   post:
 *     tags: [PT Slabs]
 *     summary: Create a PT slab row
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_EDIT),
  validate({ body: createPtSlabSchema }),
  ptSlabsController.createPtSlab,
);

/**
 * @openapi
 * /pt-slabs/{id}:
 *   get:
 *     tags: [PT Slabs]
 *     summary: Get a PT slab by id
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  validate({ params: idParamSchema }),
  ptSlabsController.getPtSlab,
);

/**
 * @openapi
 * /pt-slabs/{id}:
 *   patch:
 *     tags: [PT Slabs]
 *     summary: Update a PT slab
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_EDIT),
  validate({ params: idParamSchema, body: updatePtSlabSchema }),
  ptSlabsController.updatePtSlab,
);

/**
 * @openapi
 * /pt-slabs/{id}:
 *   delete:
 *     tags: [PT Slabs]
 *     summary: Soft-delete a PT slab
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_DELETE),
  validate({ params: idParamSchema }),
  ptSlabsController.deletePtSlab,
);

export default router;
