import mongoose from 'mongoose';

/**
 * Stored refresh tokens (hashed) with rotation family tracking.
 * Soft-revoked on rotation so reuse of an old token can be detected and
 * the entire family (and user sessions) revoked.
 * Hard TTL still cleans expired docs. Audit plugin intentionally omitted.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    familyId: {
      type: String,
      required: true,
    },
    replacedByHash: {
      type: String,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 256,
    },
    ip: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/*
 * listActiveSessionsForUser / findActiveSessionForUser filter on
 * { user, revokedAt: null, replacedByHash: null, expiresAt: { $gt: now } }
 * and sort by createdAt desc. The previous index named `revokedByHash`,
 * a field that does not exist on this schema, so it never matched.
 */
refreshTokenSchema.index({
  user: 1,
  revokedAt: 1,
  replacedByHash: 1,
  expiresAt: 1,
});

// revokeFamily(): { familyId, revokedAt: null }
refreshTokenSchema.index({ familyId: 1, revokedAt: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
