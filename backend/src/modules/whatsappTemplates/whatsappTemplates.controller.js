import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { WHATSAPP_TEMPLATES_MESSAGES } from './whatsappTemplates.constants.js';
import * as whatsappTemplatesService from './whatsappTemplates.service.js';

export const listTemplateFields = asyncHandler(async (_req, res) => {
  const fields = whatsappTemplatesService.listTemplateFields();
  return sendSuccess(res, { fields }, WHATSAPP_TEMPLATES_MESSAGES.FIELDS_FETCHED);
});

export const listWhatsAppTemplates = asyncHandler(async (req, res) => {
  const result = await whatsappTemplatesService.listWhatsAppTemplates(req.query);
  return sendSuccess(res, result, WHATSAPP_TEMPLATES_MESSAGES.FETCHED);
});

export const getWhatsAppTemplate = asyncHandler(async (req, res) => {
  const template = await whatsappTemplatesService.getWhatsAppTemplate(
    req.params.id,
  );
  return sendSuccess(res, { template }, WHATSAPP_TEMPLATES_MESSAGES.FETCHED);
});

export const createWhatsAppTemplate = asyncHandler(async (req, res) => {
  const template = await whatsappTemplatesService.createWhatsAppTemplate(
    req.body,
    req.user.id,
  );
  return sendSuccess(
    res,
    { template },
    WHATSAPP_TEMPLATES_MESSAGES.CREATED,
    201,
  );
});

export const updateWhatsAppTemplate = asyncHandler(async (req, res) => {
  const template = await whatsappTemplatesService.updateWhatsAppTemplate(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { template }, WHATSAPP_TEMPLATES_MESSAGES.UPDATED);
});

export const deleteWhatsAppTemplate = asyncHandler(async (req, res) => {
  await whatsappTemplatesService.deleteWhatsAppTemplate(
    req.params.id,
    req.user.id,
  );
  return sendSuccess(res, null, WHATSAPP_TEMPLATES_MESSAGES.DELETED);
});
