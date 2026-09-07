import { randomUUID } from 'node:crypto';

import config from '../../config/index.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../email/emailService.js';
import AppError from '../../utils/AppError.js';
import { generateRandomToken, sha256 } from '../../utils/crypto.js';
import {
  decodeToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import logger from '../../utils/logger.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import { ROLE_NAMES } from '../roles/roles.constants.js';
import * as rolesRepository from '../roles/roles.repository.js';
import { AUTH_CODES } from './auth.constants.js';
import * as authRepository from './auth.repository.js';

const MINUTE_MS = 60 * 1000;

const issueTokenPair = async (
  user,
  { familyId = null, userAgent = null, ip = null } = {},
) => {
  const accessToken = signAccessToken({ sub: user.id });
  const refreshToken = signRefreshToken({ sub: user.id });
  const { exp } = decodeToken(refreshToken);
  const refreshTokenExpiresAt = new Date(exp * 1000);
  const family = familyId || randomUUID();
  const tokenHash = sha256(refreshToken);

  await authRepository.createRefreshToken({
    user: user.id,
    tokenHash,
    familyId: family,
    userAgent: userAgent ? String(userAgent).slice(0, 256) : null,
    ip: ip || null,
    expiresAt: refreshTokenExpiresAt,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt, tokenHash, family };
};

const assertLoginable = (user) => {
  if (!user.isEmailVerified) {
    throw new AppError('Please verify your email before logging in', 403, {
      code: AUTH_CODES.EMAIL_NOT_VERIFIED,
    });
  }
  if (!user.isActive) {
    throw new AppError('Your account has been disabled', 403, {
      code: AUTH_CODES.ACCOUNT_DISABLED,
    });
  }
};

const revokeForTheft = async (userId, familyId, reason) => {
  if (familyId) {
    await authRepository.revokeFamily(familyId);
  }
  await authRepository.revokeAllRefreshTokensForUser(userId);
  await authRepository.deleteAllRefreshTokensForUser(userId);
  logger.warn(`[auth] ${reason} for user ${userId} — all sessions revoked`);

  await recordActivity({
    action: ACTIVITY_ACTIONS.AUTH_TOKEN_REUSE_DETECTED,
    entityType: ENTITY_TYPES.SESSION,
    entityId: familyId,
    actorId: userId,
    outcome: 'failure',
    changes: { reason },
  });
};

// ---------- Register / verify ----------

export const register = async ({ name, email, password }) => {
  const existing = await authRepository.findUserByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists', 409, {
      code: AUTH_CODES.EMAIL_IN_USE,
    });
  }

  const rawToken = generateRandomToken();
  const defaultRole = await rolesRepository.findRoleByName(ROLE_NAMES.USER);

  const user = await authRepository.createUser({
    name: sanitizeUserHtml(name),
    email,
    password: await hashPassword(password),
    role: defaultRole?.id ?? null,
    isActive: false,
    isEmailVerified: false,
    emailVerificationToken: sha256(rawToken),
    emailVerificationExpires: new Date(
      Date.now() + config.auth.emailVerificationExpiryMin * MINUTE_MS,
    ),
  });

  const verificationUrl = `${config.clientUrl}/verify-email?token=${rawToken}`;

  try {
    // Queue (or inline fallback) — registration never fails because of SMTP
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
      userId: user.id,
    });
  } catch (err) {
    logger.warn(
      `[email] Verification email enqueue/send failed (registration kept): ${err.message}`,
    );
    if (!config.isProduction) {
      logger.debug('[email][dev-only] Verification email was not delivered');
    }
  }

  // EXPOSE_AUTH_TOKENS=true lets e2e/smoke tests verify without SMTP.
  // Never enable in production.
  if (config.exposeAuthTokens) {
    return { user, verificationToken: rawToken };
  }

  return { user };
};

export const verifyEmail = async (rawToken) => {
  const user = await authRepository.findUserByVerificationTokenHash(
    sha256(rawToken),
  );

  if (!user) {
    throw new AppError('Verification link is invalid or has expired', 400, {
      code: AUTH_CODES.INVALID_VERIFICATION_TOKEN,
    });
  }

  user.isEmailVerified = true;
  user.isActive = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await authRepository.saveUser(user);

  return user;
};

// ---------- Login / refresh / logout ----------

export const login = async ({ email, password }, meta = {}) => {
  const user = await authRepository.findUserByEmailWithPassword(email);

  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Invalid email or password', 401, {
      code: AUTH_CODES.INVALID_CREDENTIALS,
    });
  }

  assertLoginable(user);

  const tokens = await issueTokenPair(user, meta);

  await recordActivity({
    action: ACTIVITY_ACTIONS.AUTH_LOGIN,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    actorId: user.id,
    actorEmail: user.email,
  });

  return { user, ...tokens };
};

export const refreshTokens = async (rawRefreshToken, meta = {}) => {
  if (!rawRefreshToken) {
    throw new AppError('Refresh token missing', 401, {
      code: AUTH_CODES.INVALID_REFRESH_TOKEN,
    });
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, {
      code: AUTH_CODES.INVALID_REFRESH_TOKEN,
    });
  }

  const tokenHash = sha256(rawRefreshToken);
  const stored = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!stored) {
    await revokeForTheft(
      payload.sub,
      null,
      'Refresh token reuse detected (unknown/rotated token)',
    );
    throw new AppError('Invalid or expired refresh token', 401, {
      code: AUTH_CODES.INVALID_REFRESH_TOKEN,
    });
  }

  if (stored.revokedAt || stored.replacedByHash) {
    await revokeForTheft(
      payload.sub,
      stored.familyId,
      'Refresh token reuse detected (already rotated)',
    );
    throw new AppError('Invalid or expired refresh token', 401, {
      code: AUTH_CODES.INVALID_REFRESH_TOKEN,
    });
  }

  const user = await authRepository.findUserById(payload.sub);
  if (!user) {
    throw new AppError('User no longer exists', 401, {
      code: AUTH_CODES.UNAUTHORIZED,
    });
  }
  assertLoginable(user);

  const tokens = await issueTokenPair(user, {
    familyId: stored.familyId,
    userAgent: meta.userAgent ?? stored.userAgent,
    ip: meta.ip ?? stored.ip,
  });

  stored.replacedByHash = tokens.tokenHash;
  stored.revokedAt = new Date();
  await authRepository.saveRefreshToken(stored);

  return { user, ...tokens };
};

export const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;
  const stored = await authRepository.findRefreshTokenByHash(
    sha256(rawRefreshToken),
  );
  if (stored && !stored.revokedAt) {
    stored.revokedAt = new Date();
    await authRepository.saveRefreshToken(stored);
  }
};

export const logoutEverywhere = async (userId) => {
  await authRepository.revokeAllRefreshTokensForUser(userId);
  await authRepository.deleteAllRefreshTokensForUser(userId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.AUTH_LOGOUT_ALL,
    entityType: ENTITY_TYPES.SESSION,
    entityId: String(userId),
    actorId: userId,
  });
};

export const listSessions = async (userId) => {
  const sessions = await authRepository.listActiveSessionsForUser(userId);
  return sessions.map((session) => ({
    id: session.id,
    familyId: session.familyId,
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }));
};

export const revokeSession = async (userId, sessionId) => {
  const session = await authRepository.findActiveSessionForUser(
    sessionId,
    userId,
  );
  if (!session) {
    throw new AppError('Session not found', 404, {
      code: AUTH_CODES.SESSION_NOT_FOUND,
    });
  }
  await authRepository.revokeFamily(session.familyId);
};

// ---------- Password flows ----------

export const forgotPassword = async (email) => {
  const user = await authRepository.findUserByEmail(email);
  if (!user) {
    return;
  }

  const rawToken = generateRandomToken();
  user.passwordResetToken = sha256(rawToken);
  user.passwordResetExpires = new Date(
    Date.now() + config.auth.passwordResetExpiryMin * MINUTE_MS,
  );
  await authRepository.saveUser(user);

  const resetUrl = `${config.clientUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      userId: user.id,
    });
  } catch (err) {
    logger.warn(`[email] Password reset enqueue/send failed: ${err.message}`);

    if (config.isProduction) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await authRepository.saveUser(user);
      throw new AppError(
        'Could not queue password reset email. Please try again later.',
        500,
        { code: AUTH_CODES.EMAIL_SEND_FAILED },
      );
    }
  }
};

export const resetPassword = async ({ token, password }) => {
  const user = await authRepository.findUserByResetTokenHash(sha256(token));

  if (!user) {
    throw new AppError('Reset link is invalid or has expired', 400, {
      code: AUTH_CODES.INVALID_RESET_TOKEN,
    });
  }

  user.password = await hashPassword(password);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.passwordChangedAt = new Date(Date.now() - 1000);
  await authRepository.saveUser(user);

  await authRepository.deleteAllRefreshTokensForUser(user.id);

  await recordActivity({
    action: ACTIVITY_ACTIONS.AUTH_PASSWORD_RESET,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    actorId: user.id,
    actorEmail: user.email,
  });
};

export const changePassword = async (
  userId,
  { currentPassword, newPassword },
  meta = {},
) => {
  const user = await authRepository.findUserByIdWithPassword(userId);

  if (!user || !(await comparePassword(currentPassword, user.password))) {
    throw new AppError('Current password is incorrect', 401, {
      code: AUTH_CODES.INVALID_CREDENTIALS,
    });
  }

  user.password = await hashPassword(newPassword);
  user.passwordChangedAt = new Date(Date.now() - 1000);
  await authRepository.saveUser(user);

  await authRepository.deleteAllRefreshTokensForUser(user.id);
  const tokens = await issueTokenPair(user, meta);

  await recordActivity({
    action: ACTIVITY_ACTIONS.AUTH_PASSWORD_CHANGE,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    actorId: user.id,
    actorEmail: user.email,
  });

  return { user, ...tokens };
};
