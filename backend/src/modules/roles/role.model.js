import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * Role with an embedded array of permission refs (many-to-many).
 * Chosen over a join collection: role counts are small, the whole set is
 * always read together, and updates replace the array atomically.
 * `isSystemRole` protects seeded roles (Super Admin, User) from deletion.
 */
const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters'],
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [200, 'Description cannot exceed 200 characters'],
  },
  isSystemRole: {
    type: Boolean,
    default: false,
  },
  permissions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
    },
  ],
});

roleSchema.plugin(auditPlugin);

roleSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

// findAllRoles(): { isDeleted: false } sorted by name — covered end to end
roleSchema.index({ isDeleted: 1, name: 1 });

// pullPermissionFromRoles(): updateMany({ permissions: <id> }) when a
// permission is deleted — a multikey index on the embedded refs
roleSchema.index({ permissions: 1 });

roleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const Role = mongoose.model('Role', roleSchema);

export default Role;
