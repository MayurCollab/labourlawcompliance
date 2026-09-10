import { Router } from 'express';

import * as whatsappSendsController from '../modules/whatsappSends/whatsappSends.controller.js';

/**
 * Public provider webhooks (no JWT).
 * MSG91 dashboard URL:
 *   https://<host>/api/webhooks/whatsapp/status
 */
const router = Router();

router.post('/whatsapp/status', whatsappSendsController.msg91WhatsAppWebhook);

export default router;
