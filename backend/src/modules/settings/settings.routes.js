import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as settingsController from './settings.controller.js';
import { updateSettingsSchema } from './settings.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get consultancy defaults (signatory, etc.)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  settingsController.getSettings,
);

/**
 * @openapi
 * /settings:
 *   patch:
 *     tags: [Settings]
 *     summary: Update consultancy defaults
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_EDIT),
  validate({ body: updateSettingsSchema }),
  settingsController.updateSettings,
);

export default router;
