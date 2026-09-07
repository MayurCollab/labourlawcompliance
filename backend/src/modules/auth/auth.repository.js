import User from '../users/user.model.js';
import RefreshToken from './refreshToken.model.js';

/**
 * Auth repository — the ONLY layer that touches Mongoose models.
 * Limited to what Auth needs; the Users module gets its own repository.
 */

// ---------- User ----------

export const createUser = (data) => User.create(data);

export const findUserByEmail = (email) => User.findOne({ email });

export const findUserByEmailWithPassword = (email) =>
  User.findOne({ email })
    .select('+password +passwordChangedAt')
    .populate({
      path: 'role',
      select: 'name permissions',
      populate: { path: 'permissions', select: 'name' },
    });

export const findUserById = (id) => User.findById(id);

export const findUserByIdWithAuthState = (id) =>
  User.findById(id).select('+passwordChangedAt');

export const findUserByIdWithPassword = (id) =>
  User.findById(id).select('+password');

export const findUserByVerificationTokenHash = (tokenHash) =>
  User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

export const findUserByResetTokenHash = (tokenHash) =>
  User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

export const saveUser = (user) => user.save();

// ---------- Refresh tokens ----------

export const createRefreshToken = (data) => RefreshToken.create(data);

export const findRefreshTokenByHash = (tokenHash) =>
  RefreshToken.findOne({ tokenHash });

export const saveRefreshToken = (doc) => doc.save();

export const revokeFamily = async (familyId) =>
  RefreshToken.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

export const deleteRefreshTokenByHash = (tokenHash) =>
  RefreshToken.deleteOne({ tokenHash });

export const deleteAllRefreshTokensForUser = (userId, session = null) =>
  RefreshToken.deleteMany({ user: userId }, { session });

export const revokeAllRefreshTokensForUser = (userId) =>
  RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

export const listActiveSessionsForUser = (userId) =>
  RefreshToken.find({
    user: userId,
    revokedAt: null,
    replacedByHash: null,
    expiresAt: { $gt: new Date() },
  })
    .select('_id familyId userAgent ip createdAt expiresAt')
    .sort({ createdAt: -1 });

export const findActiveSessionForUser = (sessionId, userId) =>
  RefreshToken.findOne({
    _id: sessionId,
    user: userId,
    revokedAt: null,
    replacedByHash: null,
    expiresAt: { $gt: new Date() },
  });
