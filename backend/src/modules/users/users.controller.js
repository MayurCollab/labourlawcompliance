import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import { clearSessionCookies } from '../auth/auth.cookies.js';
import { USERS_MESSAGES } from './users.constants.js';
import * as usersService from './users.service.js';

// ---------- Admin CRUD ----------

export const listUsers = asyncHandler(async (req, res) => {
  const result = await usersService.listUsers(req.query);
  return sendSuccess(res, result, USERS_MESSAGES.FETCHED);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await usersService.getUser(req.params.id);
  return sendSuccess(res, { user }, USERS_MESSAGES.FETCHED);
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body, req.user.id);
  return sendSuccess(res, { user }, USERS_MESSAGES.CREATED, 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { user }, USERS_MESSAGES.UPDATED);
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await usersService.setUserStatus(
    req.params.id,
    req.body.isActive,
    req.user.id,
  );
  return sendSuccess(res, { user }, USERS_MESSAGES.STATUS_UPDATED);
});

export const deleteUser = asyncHandler(async (req, res) => {
  await usersService.deleteUser(req.params.id, req.user.id);
  return sendSuccess(res, null, USERS_MESSAGES.DELETED);
});

// ---------- Own profile ----------

export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await usersService.getMyProfile(req.user.id);
  return sendSuccess(res, { user }, USERS_MESSAGES.PROFILE_FETCHED);
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await usersService.updateMyProfile(req.user.id, req.body);
  return sendSuccess(res, { user }, USERS_MESSAGES.PROFILE_UPDATED);
});

export const updateMyAvatar = asyncHandler(async (req, res) => {
  const user = await usersService.updateMyAvatar(req.user.id, req.file);
  return sendSuccess(res, { user }, USERS_MESSAGES.AVATAR_UPDATED);
});

// ---------- Data compliance ----------

/**
 * GET /users/me/export — downloads the caller's own data as a JSON file.
 * Sent as an attachment so a browser hitting the URL directly gets a file
 * rather than a wall of JSON.
 */
export const exportMyData = asyncHandler(async (req, res) => {
  const data = await usersService.exportUserData(req.user.id);

  await recordActivity({
    action: ACTIVITY_ACTIONS.USER_DATA_EXPORT,
    entityType: ENTITY_TYPES.USER,
    entityId: req.user.id,
  });

  const filename = `user-data-${req.user.id}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(JSON.stringify(data, null, 2));
});

/**
 * DELETE /users/me — irreversible self-service erasure. Requires the current
 * password in the body and clears the session cookies on the way out.
 */
export const eraseMyAccount = asyncHandler(async (req, res) => {
  const result = await usersService.eraseMyAccount(
    req.user.id,
    req.body.password,
  );

  clearSessionCookies(res);
  return sendSuccess(res, result, USERS_MESSAGES.ERASED);
});

/** DELETE /users/:id/erase — admin-initiated erasure (users.erase). */
export const eraseUser = asyncHandler(async (req, res) => {
  const result = await usersService.eraseUser(req.params.id, req.user.id, {
    reason: req.body?.reason ?? null,
  });

  return sendSuccess(res, result, USERS_MESSAGES.ERASED);
});

/** Admin: upload/replace another user's avatar (users.edit). */
export const updateUserAvatar = asyncHandler(async (req, res) => {
  const user = await usersService.updateMyAvatar(
    req.params.id,
    req.file,
    req.user.id,
  );
  return sendSuccess(res, { user }, USERS_MESSAGES.AVATAR_UPDATED);
});
