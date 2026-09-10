import asyncHandler from '../../middleware/asyncHandler.js';
import AppError from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import {
  WHATSAPP_SENDS_CODES,
  WHATSAPP_SENDS_MESSAGES,
} from './whatsappSends.constants.js';
import * as whatsappSendsService from './whatsappSends.service.js';

/**
 * GET /api/v1/whatsapp-sends
 */
export const listWhatsAppSends = asyncHandler(async (req, res) => {
  const result = await whatsappSendsService.listWhatsAppSends(req.query);
  return sendSuccess(res, result, WHATSAPP_SENDS_MESSAGES.FETCHED);
});

/**
 * POST /api/webhooks/whatsapp/status
 * Also available at POST /api/v1/whatsapp-sends/webhooks/msg91
 * Public MSG91 outbound delivery callback (sent / delivered / read / failed).
 */
export const msg91WhatsAppWebhook = asyncHandler(async (req, res) => {
  if (!whatsappSendsService.assertWebhookAuthorized(req)) {
    throw new AppError('Unauthorized WhatsApp webhook.', 401, {
      code: WHATSAPP_SENDS_CODES.WEBHOOK_UNAUTHORIZED,
    });
  }

  const result = await whatsappSendsService.applyWhatsAppStatusWebhook(
    req.body,
  );

  // MSG91 expects a fast 2xx; include match info for debugging only.
  return sendSuccess(
    res,
    { matched: result.matched, changed: result.changed ?? false },
    WHATSAPP_SENDS_MESSAGES.WEBHOOK_OK,
  );
});
