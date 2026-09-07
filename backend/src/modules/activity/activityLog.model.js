import mongoose from 'mongoose';

/**
 * Append-only activity/audit trail.
 *
 * Deliberately does NOT use auditPlugin: that plugin adds soft-delete and
 * updatedBy, which are exactly the mutation paths this collection must not
 * have. A record that can be edited after the fact is not evidence.
 *
 * Write-once is enforced three ways:
 *   1. every field is `immutable`, so Mongoose drops changes on a re-save
 *   2. `pre('save')` rejects saving an existing document
 *   3. every update/delete query hook throws before reaching the driver
 *
 * Application-level guards only stop application code. See README
 * ("Audit log immutability") for the MongoDB user privileges that make this
 * hold against anything with a connection string.
 */
const activityLogSchema = new mongoose.Schema(
  {
    /** Dot-namespaced verb, e.g. `users.create`, `roles.permissions.update` */
    action: { type: String, required: true, immutable: true },

    entityType: { type: String, required: true, immutable: true },
    entityId: { type: String, default: null, immutable: true },

    /** Null for unauthenticated actions (e.g. a failed login attempt) */
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
    },
    actorEmail: { type: String, default: null, immutable: true },

    /** Correlates a log entry back to the request that produced it */
    requestId: { type: String, default: null, immutable: true },
    ip: { type: String, default: null, immutable: true },
    userAgent: { type: String, default: null, immutable: true },

    /**
     * Field-level summary of what changed. Store changed field NAMES and
     * non-sensitive values only — never passwords, tokens or full documents.
     */
    changes: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },

    outcome: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
      immutable: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Reject unknown fields rather than silently dropping them
    strict: 'throw',
  },
);

// Read patterns: newest first, optionally scoped to an actor or an entity
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

const immutableError = (operation) =>
  Object.assign(
    new Error(
      `ActivityLog is append-only: "${operation}" is not permitted on audit records.`,
    ),
    { name: 'ImmutableCollectionError', statusCode: 500 },
  );

activityLogSchema.pre('save', function rejectResave(next) {
  if (!this.isNew) {
    return next(immutableError('save (update)'));
  }
  return next();
});

[
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
].forEach((method) => {
  activityLogSchema.pre(method, function rejectMutation(next) {
    next(immutableError(method));
  });
});

activityLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
