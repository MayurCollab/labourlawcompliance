import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import { uploadDocument } from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as templatesController from './templates.controller.js';
import {
  assignTemplateSchema,
  bundledTemplateCodeSchema,
  createTemplateSchema,
  listTemplatesQuerySchema,
  resolveTemplateQuerySchema,
  updateTemplateSchema,
} from './templates.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /templates/canonical:
 *   get:
 *     tags: [Templates]
 *     summary: Canonical Form 5 fields for the mapping UI
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/canonical',
  checkPermission(PERMISSION_NAMES.TEMPLATES_VIEW),
  templatesController.listCanonical,
);

/**
 * @openapi
 * /templates/resolve:
 *   get:
 *     tags: [Templates]
 *     summary: Resolve Form 5 template for a client (client > location > global)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/resolve',
  checkPermission(PERMISSION_NAMES.TEMPLATES_VIEW),
  validate({ query: resolveTemplateQuerySchema }),
  templatesController.resolveTemplate,
);

/**
 * @openapi
 * /templates/bundled:
 *   get:
 *     tags: [Templates]
 *     summary: List fixed Form 5 HTML templates shipped with the app
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/bundled',
  checkPermission(PERMISSION_NAMES.TEMPLATES_VIEW),
  templatesController.listBundledTemplates,
);

/**
 * @openapi
 * /templates/bundled/{code}/preview:
 *   get:
 *     tags: [Templates]
 *     summary: Preview a bundled Form 5 HTML template with sample data
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/bundled/:code/preview',
  checkPermission(PERMISSION_NAMES.TEMPLATES_VIEW),
  validate({ params: bundledTemplateCodeSchema }),
  templatesController.previewBundledTemplate,
);

/**
 * @openapi
 * /templates:
 *   get:
 *     tags: [Templates]
 *     summary: List Form 5 templates
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.TEMPLATES_VIEW),
  validate({ query: listTemplatesQuerySchema }),
  templatesController.listTemplates,
);

/**
 * @openapi
 * /templates:
 *   post:
 *     tags: [Templates]
 *     summary: Upload a Form 5 Excel, Word, or PDF template and auto-map fields
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.TEMPLATES_CREATE),
  uploadDocument('file'),
  validate({ body: createTemplateSchema }),
  templatesController.createTemplate,
);

router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.TEMPLATES_VIEW),
  validate({ params: idParamSchema }),
  templatesController.getTemplate,
);

router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.TEMPLATES_EDIT),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  templatesController.updateTemplate,
);

router.post(
  '/:id/assign',
  checkPermission(PERMISSION_NAMES.TEMPLATES_EDIT),
  validate({ params: idParamSchema, body: assignTemplateSchema }),
  templatesController.assignTemplate,
);

router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.TEMPLATES_DELETE),
  validate({ params: idParamSchema }),
  templatesController.deleteTemplate,
);

export default router;
