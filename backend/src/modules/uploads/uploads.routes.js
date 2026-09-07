import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import { uploadDocument } from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as uploadsController from './uploads.controller.js';
import {
  createUploadSchema,
  importUploadSchema,
  listUploadsQuerySchema,
  previewUploadSchema,
  purgeClientMasterSchema,
  purgeMasterSchema,
  purgeSalarySchema,
  listUploadRowsSchema,
} from './uploads.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /uploads:
 *   get:
 *     tags: [Uploads]
 *     summary: List MasterSheet and salary uploads
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.UPLOADS_VIEW),
  validate({ query: listUploadsQuerySchema }),
  uploadsController.listUploads,
);

/**
 * @openapi
 * /uploads:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload a MasterSheet or salary workbook and return column mapping + preview
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               kind: { type: string, enum: [master, salary, clientMaster], default: master }
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: File stored and parsed
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.UPLOADS_CREATE),
  uploadDocument('file'),
  validate({ body: createUploadSchema }),
  uploadsController.createUpload,
);

/**
 * @openapi
 * /uploads/purge/master:
 *   post:
 *     tags: [Uploads]
 *     summary: Clear all imported client and filing master data
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/purge/master',
  checkPermission(PERMISSION_NAMES.UPLOADS_PURGE),
  validate({ body: purgeMasterSchema }),
  uploadsController.purgeMasterData,
);

/**
 * @openapi
 * /uploads/purge/salary:
 *   post:
 *     tags: [Uploads]
 *     summary: Clear imported salary employee rows for a month
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/purge/salary',
  checkPermission(PERMISSION_NAMES.UPLOADS_PURGE),
  validate({ body: purgeSalarySchema }),
  uploadsController.purgeSalaryData,
);

/**
 * @openapi
 * /uploads/purge/client-master:
 *   post:
 *     tags: [Uploads]
 *     summary: Clear imported client address and RC fields
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/purge/client-master',
  checkPermission(PERMISSION_NAMES.UPLOADS_PURGE),
  validate({ body: purgeClientMasterSchema }),
  uploadsController.purgeClientMasterData,
);

/**
 * @openapi
 * /uploads/{id}/errors:
 *   get:
 *     tags: [Uploads]
 *     summary: Download skipped and unmatched import rows as Excel
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id/errors',
  checkPermission(PERMISSION_NAMES.UPLOADS_VIEW),
  validate({ params: idParamSchema }),
  uploadsController.downloadImportErrors,
);

/**
 * @openapi
 * /uploads/{id}:
 *   get:
 *     tags: [Uploads]
 *     summary: Get an upload with its latest parse snapshot
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.UPLOADS_VIEW),
  validate({ params: idParamSchema }),
  uploadsController.getUpload,
);

/**
 * @openapi
 * /uploads/{id}/preview:
 *   post:
 *     tags: [Uploads]
 *     summary: Re-parse a different sheet in an uploaded workbook
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/preview',
  checkPermission(PERMISSION_NAMES.UPLOADS_CREATE),
  validate({ params: idParamSchema, body: previewUploadSchema }),
  uploadsController.previewUpload,
);

/**
 * @openapi
 * /uploads/{id}/rows:
 *   post:
 *     tags: [Uploads]
 *     summary: Paginated mapped rows for the uploaded workbook
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/rows',
  checkPermission(PERMISSION_NAMES.UPLOADS_VIEW),
  validate({ params: idParamSchema, body: listUploadRowsSchema }),
  uploadsController.listUploadRows,
);

/**
 * @openapi
 * /uploads/{id}/import:
 *   post:
 *     tags: [Uploads]
 *     summary: Import MasterSheet or salary OutPut rows (upsert, never silent-delete)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/import',
  checkPermission(PERMISSION_NAMES.UPLOADS_CREATE),
  validate({ params: idParamSchema, body: importUploadSchema }),
  uploadsController.importUpload,
);

export default router;
