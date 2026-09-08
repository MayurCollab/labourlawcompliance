import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { CLIENTS_MESSAGES } from './clients.constants.js';
import * as clientsService from './clients.service.js';

export const listClients = asyncHandler(async (req, res) => {
  const result = await clientsService.listClients(req.query);
  return sendSuccess(res, result, CLIENTS_MESSAGES.FETCHED);
});

export const listClientOptions = asyncHandler(async (req, res) => {
  const result = await clientsService.listClientOptions();
  return sendSuccess(res, result, CLIENTS_MESSAGES.FETCHED);
});

export const exportClients = asyncHandler(async (req, res) => {
  const { buffer, filename, mimetype } = await clientsService.exportClients(
    req.query,
  );
  res.setHeader('Content-Type', mimetype);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/"/g, '')}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buffer);
});

export const getClient = asyncHandler(async (req, res) => {
  const client = await clientsService.getClient(req.params.id);
  return sendSuccess(res, { client }, CLIENTS_MESSAGES.FETCHED);
});

export const createClient = asyncHandler(async (req, res) => {
  const client = await clientsService.createClient(req.body, req.user.id);
  return sendSuccess(res, { client }, CLIENTS_MESSAGES.CREATED, 201);
});

export const updateClient = asyncHandler(async (req, res) => {
  const client = await clientsService.updateClient(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { client }, CLIENTS_MESSAGES.UPDATED);
});

export const deleteClient = asyncHandler(async (req, res) => {
  await clientsService.deleteClient(req.params.id, req.user.id);
  return sendSuccess(res, null, CLIENTS_MESSAGES.DELETED);
});
