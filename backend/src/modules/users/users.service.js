import { withTransaction } from '../../database/withTransaction.js';
import * as emailLogRepository from '../../email/emailLog.repository.js';
import storage from '../../storage/index.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import * as activityRepository from '../activity/activity.repository.js';
import { recordActivity } from '../activity/activity.service.js';
import * as authRepository from '../auth/auth.repository.js';
import * as rolesRepository from '../roles/roles.repository.js';
import { AVATAR_FOLDER, USERS_CODES } from './users.constants.js';
import { toUserDto, toUserListDto } from './users.dto.js';
import * as usersRepository from './users.repository.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUserOrFail = async (id) => {
  const user = await usersRepository.findUserById(id);
  if (!user) {
    throw new AppError('User not found', 404, {
      code: USERS_CODES.USER_NOT_FOUND,
    });
  }
  return user;
};

const assertEmailAvailable = async (email, excludeId = null) => {
  const existing = await usersRepository.findUserByEmail(email);
  if (existing && String(existing.id) !== String(excludeId)) {
    throw new AppError('An account with this email already exists', 409, {
      code: USERS_CODES.EMAIL_IN_USE,
    });
  }
};

const assertRoleExists = async (roleId) => {
  const role = await rolesRepository.findRoleById(roleId);
  if (!role) {
    throw new AppError('The specified role does not exist', 400, {
      code: USERS_CODES.INVALID_ROLE,
    });
  }
};

const assertNotSelf = (userId, actorId, action) => {
  if (String(userId) === String(actorId)) {
    throw new AppError(`You cannot ${action} your own account`, 400, {
      code: USERS_CODES.SELF_ACTION_FORBIDDEN,
    });
  }
};

// ---------- Admin CRUD ----------

export const listUsers = async (query) => {
  const { page, limit, search, role, isActive, sortBy, sortOrder } = query;

  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: regex }, { email: regex }];
  }
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [users, total] = await Promise.all([
    usersRepository.findUsers(filter, { sort, skip, limit }),
    usersRepository.countUsers(filter),
  ]);

  return {
    users: toUserListDto(users),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getUser = async (id) => {
  const user = await findUserOrFail(id);
  return toUserDto(user);
};

export const createUser = async (data, actorId) => {
  await assertEmailAvailable(data.email);
  if (data.role) {
    await assertRoleExists(data.role);
  }

  const user = await usersRepository.createUser({
    name: sanitizeUserHtml(data.name),
    email: data.email,
    password: await hashPassword(data.password),
    phone: data.phone ?? null,
    role: data.role ?? null,
    // Admin-created accounts skip the email verification flow
    isActive: data.isActive ?? true,
    isEmailVerified: true,
    createdBy: actorId,
  });

  await recordActivity({
    action: ACTIVITY_ACTIONS.USER_CREATE,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    changes: { email: data.email, role: data.role ?? null },
  });

  return getUser(user.id);
};

export const updateUser = async (id, data, actorId) => {
  const user = await findUserOrFail(id);

  if (data.email && data.email !== user.email) {
    await assertEmailAvailable(data.email, id);
    user.email = data.email;
  }
  if (data.role !== undefined) {
    if (data.role !== null) {
      await assertRoleExists(data.role);
    }
    user.role = data.role;
  }
  if (data.name !== undefined) user.name = sanitizeUserHtml(data.name);
  if (data.phone !== undefined) user.phone = data.phone;
  user.updatedBy = actorId;

  const changedFields = user.modifiedPaths().filter((f) => f !== 'updatedBy');

  await usersRepository.saveUser(user);

  await recordActivity({
    action: ACTIVITY_ACTIONS.USER_UPDATE,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    // Field names only — values may be personal data
    changes: { fields: changedFields },
  });

  return getUser(user.id);
};

export const setUserStatus = async (id, isActive, actorId) => {
  assertNotSelf(id, actorId, isActive ? 'activate' : 'deactivate');

  const user = await findUserOrFail(id);
  user.isActive = isActive;
  user.updatedBy = actorId;
  await usersRepository.saveUser(user);

  await recordActivity({
    action: ACTIVITY_ACTIONS.USER_STATUS_CHANGE,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    changes: { isActive },
  });

  return toUserDto(user);
};

/**
 * Soft delete: flips isDeleted, keeps the row and every audit reference to it.
 * This is the default for administrative deletes — see eraseUser() for the
 * irreversible variant used to satisfy erasure requests.
 */
export const deleteUser = async (id, actorId) => {
  assertNotSelf(id, actorId, 'delete');

  const user = await findUserOrFail(id);
  await user.softDelete(actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.USER_SOFT_DELETE,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
  });
};

// ---------- Own profile ----------

export const getMyProfile = async (userId) => {
  const user = await findUserOrFail(userId);
  return toUserDto(user);
};

export const updateMyProfile = async (userId, data) => {
  const user = await findUserOrFail(userId);

  if (data.name !== undefined) user.name = sanitizeUserHtml(data.name);
  if (data.phone !== undefined) user.phone = data.phone;
  user.updatedBy = userId;

  await usersRepository.saveUser(user);
  return toUserDto(user);
};

export const updateMyAvatar = async (userId, file, actorId = userId) => {
  if (!file) {
    throw new AppError('An image file is required (field name: avatar)', 422, {
      code: USERS_CODES.FILE_REQUIRED,
    });
  }

  const user = await findUserOrFail(userId);
  const previousAvatar = user.avatar;

  const { path: avatarPath } = await storage.saveFile({
    buffer: file.buffer,
    mimetype: file.mimetype,
    folder: AVATAR_FOLDER,
  });

  user.avatar = avatarPath;
  user.updatedBy = actorId;
  await usersRepository.saveUser(user);

  // Best-effort cleanup of the replaced file
  if (previousAvatar) {
    try {
      await storage.deleteFile(previousAvatar);
    } catch (err) {
      logger.warn(`[storage] Could not delete old avatar: ${err.message}`);
    }
  }

  await recordActivity({
    action: ACTIVITY_ACTIONS.USER_AVATAR_UPDATE,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
  });

  return toUserDto(user);
};

// ---------- Data compliance ----------

/**
 * Everything this system holds about one user, as JSON.
 *
 * Scope is deliberately "data about this user", not "data this user can see":
 * their profile, their sessions, mail we sent them, and the actions they
 * performed. It does not include other users' records that they happen to
 * have administrative access to.
 */
export const exportUserData = async (userId) => {
  const user = await usersRepository.findUserByIdIncludingDeleted(userId);

  if (!user) {
    throw new AppError('User not found', 404, {
      code: USERS_CODES.USER_NOT_FOUND,
    });
  }

  const [sessions, emails, activity] = await Promise.all([
    authRepository.listActiveSessionsForUser(userId),
    emailLogRepository.findEmailLogsForUser(userId, user.email),
    activityRepository.findActivity(
      { actorId: userId },
      { sort: { createdAt: -1 }, skip: 0, limit: 1000 },
    ),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: 'blueprint-mern/user-export@1',
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      isDeleted: user.isDeleted,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    // Metadata only — the tokens themselves are stored hashed and are secrets
    sessions: sessions.map((session) => ({
      id: String(session._id),
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    })),
    emails: emails.map((entry) => ({
      template: entry.template,
      subject: entry.subject,
      status: entry.status,
      attempts: entry.attempts,
      sentAt: entry.sentAt,
      createdAt: entry.createdAt,
    })),
    activity: activity.map((entry) => ({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      outcome: entry.outcome,
      ip: entry.ip,
      createdAt: entry.createdAt,
    })),
    notes: [
      'Passwords are stored only as bcrypt hashes and are never exported.',
      'Refresh tokens are stored hashed; only session metadata is included.',
      'Activity entries are limited to the 1000 most recent actions.',
    ],
  };
};

/**
 * Hard delete / erasure — the "delete my account and data" path.
 *
 * Unlike deleteUser() this removes the row itself, every refresh token, every
 * email log naming the address, and the avatar file. It cannot be undone and
 * there is no restore.
 *
 * The activity log is intentionally NOT erased: it is append-only by design
 * and retains the actor id plus the actions taken. See README
 * ("Soft delete vs. erasure") for the retention rationale.
 */
export const eraseUser = async (id, actorId, { reason = null } = {}) => {
  const user = await usersRepository.findUserByIdIncludingDeleted(id);

  if (!user) {
    throw new AppError('User not found', 404, {
      code: USERS_CODES.USER_NOT_FOUND,
    });
  }

  const avatarPath = user.avatar;
  const { email } = user;

  const counts = await withTransaction(async (session) => {
    const [tokens, emails] = await Promise.all([
      authRepository.deleteAllRefreshTokensForUser(id, session),
      emailLogRepository.deleteEmailLogsForUser(id, email, session),
    ]);

    await usersRepository.hardDeleteUser(id, session);

    // Inside the transaction: if the erasure rolls back, so does its record
    await recordActivity({
      action: ACTIVITY_ACTIONS.USER_HARD_DELETE,
      entityType: ENTITY_TYPES.USER,
      entityId: id,
      actorId,
      changes: {
        reason,
        refreshTokensDeleted: tokens.deletedCount ?? 0,
        emailLogsDeleted: emails.deletedCount ?? 0,
        selfService: String(id) === String(actorId),
      },
      session,
    });

    return {
      refreshTokensDeleted: tokens.deletedCount ?? 0,
      emailLogsDeleted: emails.deletedCount ?? 0,
    };
  });

  // Outside the transaction: the filesystem can't participate in one, and a
  // rollback that left the row intact but the avatar gone would be worse.
  if (avatarPath) {
    try {
      await storage.deleteFile(avatarPath);
    } catch (err) {
      logger.warn(`[storage] Could not delete avatar during erasure: ${err.message}`);
    }
  }

  logger.info(`[compliance] Erased user ${id}`, counts);

  return { userId: String(id), ...counts, avatarDeleted: Boolean(avatarPath) };
};

/**
 * Self-service erasure. Requires the current password: an erasure triggered
 * by a stolen access token would be unrecoverable.
 */
export const eraseMyAccount = async (userId, password) => {
  const user =
    await usersRepository.findUserByIdWithPasswordIncludingDeleted(userId);

  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Password is incorrect', 401, {
      code: 'INVALID_CREDENTIALS',
    });
  }

  return eraseUser(userId, userId, { reason: 'self_service_request' });
};
