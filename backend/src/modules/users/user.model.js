import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * Shared User model (owned by the Users module, reused by Auth).
 * Sensitive fields use `select: false`; repositories opt in with `.select('+field')`.
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false,
  },
  phone: {
    type: String,
    trim: true,
    default: null,
  },
  avatar: {
    type: String,
    default: null,
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: false, // activated on email verification (or by an admin)
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    default: null,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
    select: false,
  },
  passwordResetToken: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
    select: false,
  },
  passwordChangedAt: {
    type: Date,
    default: null,
    select: false,
  },
});

userSchema.plugin(auditPlugin);

// Soft-deleted emails can be reused (partial unique index)
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

/*
 * Compound indexes matching the actual query patterns in users.repository /
 * users.service (every query is prefixed with isDeleted by the audit plugin):
 *
 *   listUsers()  -> { isDeleted, role?, isActive? } sorted by createdAt|updatedAt|name|email
 *   deleteRole() -> countUsers({ role })
 *
 * `role` sits before `isActive` because filtering by role is the selective
 * one; `isActive` is close to a 50/50 split and only narrows the scan.
 */
userSchema.index({ isDeleted: 1, createdAt: -1 });
userSchema.index({ isDeleted: 1, role: 1, isActive: 1, createdAt: -1 });
userSchema.index({ isDeleted: 1, name: 1 });

/*
 * Token lookups are single-document by an indexed hash plus an expiry range.
 * Sparse: only the small number of users with a live token carry these.
 */
userSchema.index(
  { emailVerificationToken: 1, emailVerificationExpires: 1 },
  { sparse: true },
);
userSchema.index(
  { passwordResetToken: 1, passwordResetExpires: 1 },
  { sparse: true },
);

// Never leak sensitive/internal fields when a user document is serialized
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.password;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.passwordChangedAt;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
