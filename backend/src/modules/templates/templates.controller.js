import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { TEMPLATES_MESSAGES } from './templates.constants.js';
import * as templatesService from './templates.service.js';

export const listBundledTemplates = asyncHandler(async (_req, res) => {
  const templates = await templatesService.listBundledTemplates();
  return sendSuccess(res, { templates }, TEMPLATES_MESSAGES.FETCHED);
});

export const previewBundledTemplate = asyncHandler(async (req, res) => {
  const result = await templatesService.previewBundledTemplate(req.params.code);
  res.type('html').send(result.html);
});

export const listCanonical = asyncHandler(async (_req, res) => {
  const schema = templatesService.listCanonical();
  return sendSuccess(res, schema, TEMPLATES_MESSAGES.FETCHED);
});

export const listTemplates = asyncHandler(async (req, res) => {
  const result = await templatesService.listTemplates(req.query);
  return sendSuccess(res, result, TEMPLATES_MESSAGES.FETCHED);
});

export const resolveTemplate = asyncHandler(async (req, res) => {
  const result = await templatesService.resolveTemplate(req.query.clientId);
  return sendSuccess(res, result, TEMPLATES_MESSAGES.RESOLVED);
});

export const getTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.getTemplate(req.params.id);
  return sendSuccess(res, { template }, TEMPLATES_MESSAGES.FETCHED);
});

export const createTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.createTemplate(
    { file: req.file, name: req.body.name, code: req.body.code },
    req.user.id,
  );
  return sendSuccess(res, { template }, TEMPLATES_MESSAGES.CREATED, 201);
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.updateTemplate(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { template }, TEMPLATES_MESSAGES.UPDATED);
});

export const assignTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.assignTemplate(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { template }, TEMPLATES_MESSAGES.ASSIGNED);
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  await templatesService.deleteTemplate(req.params.id, req.user.id);
  return sendSuccess(res, null, TEMPLATES_MESSAGES.DELETED);
});
