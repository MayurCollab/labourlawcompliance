import mongoose from 'mongoose';

/**
 * Reusable audit + soft-delete plugin.
 *
 * Usage on any schema:
 *   schema.plugin(auditPlugin);              // default user ref: 'User'
 *   schema.plugin(auditPlugin, { userRef: 'Admin' });
 *
 * Adds:
 *   - timestamps: createdAt / updatedAt
 *   - audit refs: createdBy / updatedBy
 *   - soft delete: isDeleted / deletedAt (+ softDelete()/restore() methods)
 *
 * All find/count/update/delete queries automatically exclude soft-deleted documents.
 * `aggregate` is not wrapped — add an `$match: { isDeleted: { $ne: true } }` stage
 * yourself when aggregating audited models.
 * To include soft-deleted docs, pass the query option { withDeleted: true }:
 *   Model.find({}, null, { withDeleted: true })
 *   Model.find().setOptions({ withDeleted: true })
 */
const QUERY_MIDDLEWARE = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'countDocuments',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'distinct',
];

const auditPlugin = (schema, options = {}) => {
  const userRef = options.userRef || 'User';

  schema.add({
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: userRef,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: userRef,
      default: null,
    },
    // Not indexed on its own: a two-value field is not selective enough to be
    // worth an index, and every compound index on these models leads with it.
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  });

  schema.set('timestamps', true);

  // Exclude soft-deleted documents from queries unless explicitly requested
  QUERY_MIDDLEWARE.forEach((method) => {
    schema.pre(method, function excludeSoftDeleted(next) {
      if (!this.getOptions().withDeleted) {
        // Equality (not $ne) so the query can use the { isDeleted, ... }
        // compound indexes as a single range instead of two scans.
        this.where({ isDeleted: false });
      }
      next();
    });
  });

  /**
   * Soft-delete this document (optionally recording who deleted it).
   * `options` is passed straight to save() so a caller inside a transaction
   * can hand in its session.
   */
  schema.methods.softDelete = function softDelete(userId = null, options = {}) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (userId) {
      this.updatedBy = userId;
    }
    return this.save(options);
  };

  /** Restore a soft-deleted document. */
  schema.methods.restore = function restore(userId = null) {
    this.isDeleted = false;
    this.deletedAt = null;
    if (userId) {
      this.updatedBy = userId;
    }
    return this.save();
  };
};

export default auditPlugin;
