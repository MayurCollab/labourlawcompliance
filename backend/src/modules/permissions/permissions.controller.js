import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { PERMISSIONS_MESSAGES } from './permissions.constants.js';
import * as permissionsService from './permissions.service.js';

export const listPermissions = asyncHandler(async (req, res) => {
  const permissions = await permissionsService.listPermissions({
    grouped: req.query.grouped,
  });
  return sendSuccess(res, { permissions }, PERMISSIONS_MESSAGES.FETCHED);
});

export const createPermission = asyncHandler(async (req, res) => {
  const permission = await permissionsService.createPermission(
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { permission }, PERMISSIONS_MESSAGES.CREATED, 201);
});

export const updatePermission = asyncHandler(async (req, res) => {
  const permission = await permissionsService.updatePermission(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { permission }, PERMISSIONS_MESSAGES.UPDATED);
});

export const deletePermission = asyncHandler(async (req, res) => {
  await permissionsService.deletePermission(req.params.id, req.user.id);
  return sendSuccess(res, null, PERMISSIONS_MESSAGES.DELETED);
});
