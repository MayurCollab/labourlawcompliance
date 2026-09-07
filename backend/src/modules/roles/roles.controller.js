import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { ROLES_MESSAGES } from './roles.constants.js';
import * as rolesService from './roles.service.js';

export const listRoles = asyncHandler(async (_req, res) => {
  const roles = await rolesService.listRoles();
  return sendSuccess(res, { roles }, ROLES_MESSAGES.FETCHED);
});

export const getRole = asyncHandler(async (req, res) => {
  const role = await rolesService.getRole(req.params.id);
  return sendSuccess(res, { role }, ROLES_MESSAGES.FETCHED);
});

export const createRole = asyncHandler(async (req, res) => {
  const role = await rolesService.createRole(req.body, req.user.id);
  return sendSuccess(res, { role }, ROLES_MESSAGES.CREATED, 201);
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await rolesService.updateRole(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { role }, ROLES_MESSAGES.UPDATED);
});

export const deleteRole = asyncHandler(async (req, res) => {
  await rolesService.deleteRole(req.params.id, req.user.id);
  return sendSuccess(res, null, ROLES_MESSAGES.DELETED);
});

export const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = await rolesService.updateRolePermissions(
    req.params.id,
    req.body.permissions,
    req.user.id,
  );
  return sendSuccess(res, { role }, ROLES_MESSAGES.PERMISSIONS_UPDATED);
});

export const assignUsersToRole = asyncHandler(async (req, res) => {
  const result = await rolesService.assignUsersToRole(
    req.params.id,
    req.body.userIds,
    req.user.id,
  );
  return sendSuccess(res, result, ROLES_MESSAGES.USERS_ASSIGNED);
});
