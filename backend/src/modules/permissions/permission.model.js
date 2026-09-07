import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * A single capability, named `<module>.<action>` (e.g. "users.create").
 * `module` groups permissions by resource for UI display and seeding.
 */
const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    trim: true,
    lowercase: true,
  },
  module: {
    type: String,
    required: [true, 'Module is required'],
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
});

permissionSchema.plugin(auditPlugin);

permissionSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

// findAllPermissions(): { isDeleted: false } sorted by module then name.
// Replaces the standalone `module` index — this one has it as a prefix.
permissionSchema.index({ isDeleted: 1, module: 1, name: 1 });

permissionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const Permission = mongoose.model('Permission', permissionSchema);

export default Permission;
