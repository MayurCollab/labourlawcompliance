import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import validate from '../../middleware/validate.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as whatsappSendsController from './whatsappSends.controller.js';
import { listWhatsAppSendsQuerySchema } from './whatsappSends.validation.js';

const router = Router();

/**
 * @openapi
 * /whatsapp-sends/webhooks/msg91:
 *   post:
 *     tags: [WhatsApp Sends]
 *     summary: MSG91 WhatsApp outbound delivery webhook (alias)
 *     description: >
 *       Alias of POST /api/webhooks/whatsapp/status (the URL configured in MSG91).
 *       Receives Sent / Delivered / Read / Failed events.
 *       When MSG91_WEBHOOK_SECRET is set, pass it as query `token` or
 *       header `x-webhook-secret`.
 *     responses:
 *       200:
 *         description: Webhook accepted
 */
router.post(
  '/webhooks/msg91',
  whatsappSendsController.msg91WhatsAppWebhook,
);

router.use(authenticate);

/**
 * @openapi
 * /whatsapp-sends:
 *   get:
 *     tags: [WhatsApp Sends]
 *     summary: List WhatsApp send history with delivery status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: period, schema: { type: string }, description: YYYY-MM }
 *       - { in: query, name: status, schema: { type: string, enum: [accepted, sent, delivered, read, failed] } }
 *       - { in: query, name: phone, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Paginated WhatsApp sends
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.FILINGS_VIEW),
  validate({ query: listWhatsAppSendsQuerySchema }),
  whatsappSendsController.listWhatsAppSends,
);

export default router;
