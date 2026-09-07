import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { toUserDto } from '../users/users.dto.js';
import { AUTH_MESSAGES, REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { clearSessionCookies, setSessionCookies } from './auth.cookies.js';
import * as authService from './auth.service.js';

const requestMeta = (req) => ({
  userAgent: req.get('user-agent'),
  ip: req.ip,
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  const user = result.user ?? result;
  const data = { user: toUserDto(user) };
  if (result.verificationToken) {
    data.verificationToken = result.verificationToken;
  }
  return sendSuccess(res, data, AUTH_MESSAGES.REGISTERED, 201);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  return sendSuccess(res, null, AUTH_MESSAGES.EMAIL_VERIFIED);
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
    await authService.login(req.body, requestMeta(req));

  const csrfToken = setSessionCookies(
    res,
    refreshToken,
    refreshTokenExpiresAt,
  );
  return sendSuccess(
    res,
    { user: toUserDto(user), accessToken, csrfToken },
    AUTH_MESSAGES.LOGGED_IN,
  );
});

export const refreshToken = asyncHandler(async (req, res) => {
  const {
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt,
  } = await authService.refreshTokens(
    req.cookies[REFRESH_TOKEN_COOKIE],
    requestMeta(req),
  );

  const csrfToken = setSessionCookies(
    res,
    newRefreshToken,
    refreshTokenExpiresAt,
  );
  return sendSuccess(
    res,
    { accessToken, csrfToken },
    AUTH_MESSAGES.TOKEN_REFRESHED,
  );
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[REFRESH_TOKEN_COOKIE]);
  clearSessionCookies(res);
  return sendSuccess(res, null, AUTH_MESSAGES.LOGGED_OUT);
});

export const logoutEverywhere = asyncHandler(async (req, res) => {
  await authService.logoutEverywhere(req.user.id);
  clearSessionCookies(res);
  return sendSuccess(res, null, AUTH_MESSAGES.LOGGED_OUT_EVERYWHERE);
});

export const listSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.listSessions(req.user.id);
  return sendSuccess(res, { sessions }, AUTH_MESSAGES.SESSIONS_FETCHED);
});

export const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.user.id, req.params.id);
  return sendSuccess(res, null, AUTH_MESSAGES.SESSION_REVOKED);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return sendSuccess(res, null, AUTH_MESSAGES.FORGOT_PASSWORD);
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return sendSuccess(res, null, AUTH_MESSAGES.PASSWORD_RESET);
});

export const changePassword = asyncHandler(async (req, res) => {
  const {
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt,
  } = await authService.changePassword(
    req.user.id,
    req.body,
    requestMeta(req),
  );

  const csrfToken = setSessionCookies(
    res,
    newRefreshToken,
    refreshTokenExpiresAt,
  );
  return sendSuccess(
    res,
    { accessToken, csrfToken },
    AUTH_MESSAGES.PASSWORD_CHANGED,
  );
});
