import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as filingsController from './filings.controller.js';
import {
  bulkGenerateFilingsSchema,
  downloadFilingQuerySchema,
  generateFilingBodySchema,
  listFilingsQuerySchema,
  listPtMismatchesQuerySchema,
  sendFilingWhatsAppSchema,
  updateFilingOverridesSchema,
} from './filings.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /filings:
 *   get:
 *     tags: [Filings]
 *     summary: List monthly Form 5 filing stubs
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: period, schema: { type: string }, description: YYYY-MM }
 *     responses:
 *       200:
 *         description: Paginated filing list
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.FILINGS_VIEW),
  validate({ query: listFilingsQuerySchema }),
  filingsController.listFilings,
);

/**
 * @openapi
 * /filings/bulk-generate:
 *   post:
 *     tags: [Filings]
 *     summary: Generate Form 5 for selected rows or a filtered month; skip missing templates
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/bulk-generate',
  checkPermission(PERMISSION_NAMES.FILINGS_GENERATE),
  validate({ body: bulkGenerateFilingsSchema }),
  filingsController.bulkGenerateFilings,
);

/**
 * @openapi
 * /filings/pt-mismatches:
 *   get:
 *     tags: [Filings]
 *     summary: MasterSheet P.Tax vs salary employee total mismatches
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/pt-mismatches',
  checkPermission(PERMISSION_NAMES.FILINGS_VIEW),
  validate({ query: listPtMismatchesQuerySchema }),
  filingsController.listPtMismatches,
);

/**
 * @openapi
 * /filings/{id}:
 *   get:
 *     tags: [Filings]
 *     summary: Get a filing including the latest PT computation
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.FILINGS_VIEW),
  validate({ params: idParamSchema }),
  filingsController.getFiling,
);

/**
 * @openapi
 * /filings/{id}/compute:
 *   post:
 *     tags: [Filings]
 *     summary: Bucket salary PT GROSS into slabs and save Total A / NIL B / NIL interest
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/compute',
  checkPermission(PERMISSION_NAMES.FILINGS_EDIT),
  validate({ params: idParamSchema }),
  filingsController.computeFiling,
);

/**
 * @openapi
 * /filings/{id}/overrides:
 *   patch:
 *     tags: [Filings]
 *     summary: Save manual Form 5 fields (address, signatory, date, additional tax)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id/overrides',
  checkPermission(PERMISSION_NAMES.FILINGS_EDIT),
  validate({ params: idParamSchema, body: updateFilingOverridesSchema }),
  filingsController.updateFilingOverrides,
);

/**
 * @openapi
 * /filings/{id}/generate:
 *   post:
 *     tags: [Filings]
 *     summary: Fill the resolved Form 5 template and store a downloadable file
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/generate',
  checkPermission(PERMISSION_NAMES.FILINGS_GENERATE),
  validate({ params: idParamSchema, body: generateFilingBodySchema }),
  filingsController.generateFiling,
);

/**
 * @openapi
 * /filings/{id}/download:
 *   get:
 *     tags: [Filings]
 *     summary: Download the current (or a historical) filled Form 5 file
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id/download',
  checkPermission(PERMISSION_NAMES.FILINGS_VIEW),
  validate({ params: idParamSchema, query: downloadFilingQuerySchema }),
  filingsController.downloadFiling,
);

/**
 * @openapi
 * /filings/{id}/whatsapp:
 *   post:
 *     tags: [Filings]
 *     summary: Send the generated Form 5 PDF on WhatsApp via MSG91
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/whatsapp',
  checkPermission(PERMISSION_NAMES.FILINGS_SEND),
  validate({ params: idParamSchema, body: sendFilingWhatsAppSchema }),
  filingsController.sendFilingWhatsApp,
);

export default router;
