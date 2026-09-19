import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as whatsappTemplatesController from './whatsappTemplates.controller.js';
import {
  createWhatsAppTemplateSchema,
  listWhatsAppTemplatesQuerySchema,
  updateWhatsAppTemplateSchema,
} from './whatsappTemplates.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /whatsapp-templates/fields:
 *   get:
 *     tags: [WhatsApp Templates]
 *     summary: List data fields a template variable can be mapped to
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/fields',
  checkPermission(PERMISSION_NAMES.WHATSAPP_TEMPLATES_VIEW),
  whatsappTemplatesController.listTemplateFields,
);

/**
 * @openapi
 * /whatsapp-templates:
 *   get:
 *     tags: [WhatsApp Templates]
 *     summary: List WhatsApp templates
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.WHATSAPP_TEMPLATES_VIEW),
  validate({ query: listWhatsAppTemplatesQuerySchema }),
  whatsappTemplatesController.listWhatsAppTemplates,
);

/**
 * @openapi
 * /whatsapp-templates:
 *   post:
 *     tags: [WhatsApp Templates]
 *     summary: Create a WhatsApp template record
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.WHATSAPP_TEMPLATES_CREATE),
  validate({ body: createWhatsAppTemplateSchema }),
  whatsappTemplatesController.createWhatsAppTemplate,
);

/**
 * @openapi
 * /whatsapp-templates/{id}:
 *   get:
 *     tags: [WhatsApp Templates]
 *     summary: Get a WhatsApp template by id
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.WHATSAPP_TEMPLATES_VIEW),
  validate({ params: idParamSchema }),
  whatsappTemplatesController.getWhatsAppTemplate,
);

/**
 * @openapi
 * /whatsapp-templates/{id}:
 *   patch:
 *     tags: [WhatsApp Templates]
 *     summary: Update a WhatsApp template
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.WHATSAPP_TEMPLATES_EDIT),
  validate({ params: idParamSchema, body: updateWhatsAppTemplateSchema }),
  whatsappTemplatesController.updateWhatsAppTemplate,
);

/**
 * @openapi
 * /whatsapp-templates/{id}:
 *   delete:
 *     tags: [WhatsApp Templates]
 *     summary: Soft-delete a WhatsApp template
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.WHATSAPP_TEMPLATES_DELETE),
  validate({ params: idParamSchema }),
  whatsappTemplatesController.deleteWhatsAppTemplate,
);

export default router;
