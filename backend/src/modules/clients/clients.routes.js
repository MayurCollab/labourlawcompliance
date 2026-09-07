import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as clientsController from './clients.controller.js';
import {
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from './clients.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /clients:
 *   get:
 *     tags: [Clients]
 *     summary: List employer clients
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: locationId, schema: { type: string } }
 *       - { in: query, name: fundCode, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Paginated client list
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  validate({ query: listClientsQuerySchema }),
  clientsController.listClients,
);

/**
 * @openapi
 * /clients/options:
 *   get:
 *     tags: [Clients]
 *     summary: Compact clients and legal-company names for pickers
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/options',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  clientsController.listClientOptions,
);

/**
 * @openapi
 * /clients:
 *   post:
 *     tags: [Clients]
 *     summary: Create an employer client
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientCode, companyName, locationName]
 *             properties:
 *               clientCode: { type: string, example: C0001 }
 *               companyName: { type: string }
 *               locationName: { type: string, example: Ahmedabad }
 *               phyCode: { type: string, example: '0083' }
 *               rcNumber: { type: string }
 *               address: { type: string }
 *     responses:
 *       201:
 *         description: Client created
 *       409:
 *         description: Client code already exists
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.CLIENTS_CREATE),
  validate({ body: createClientSchema }),
  clientsController.createClient,
);

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     tags: [Clients]
 *     summary: Get a client by id
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_VIEW),
  validate({ params: idParamSchema }),
  clientsController.getClient,
);

/**
 * @openapi
 * /clients/{id}:
 *   patch:
 *     tags: [Clients]
 *     summary: Update a client
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_EDIT),
  validate({ params: idParamSchema, body: updateClientSchema }),
  clientsController.updateClient,
);

/**
 * @openapi
 * /clients/{id}:
 *   delete:
 *     tags: [Clients]
 *     summary: Soft-delete a client
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.CLIENTS_DELETE),
  validate({ params: idParamSchema }),
  clientsController.deleteClient,
);

export default router;
