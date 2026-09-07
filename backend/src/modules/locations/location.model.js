import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * Place lookup used by clients and (later) per-location Form 5 templates.
 * Names are unique case-insensitively via `nameKey`.
 */
const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true,
    maxlength: [100, 'Location name cannot exceed 100 characters'],
  },
  nameKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  defaultTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    default: null,
  },
});

locationSchema.plugin(auditPlugin);

locationSchema.index(
  { nameKey: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
locationSchema.index({ isDeleted: 1, name: 1 });

locationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    delete ret.nameKey;
    return ret;
  },
});

const Location = mongoose.model('Location', locationSchema);

export default Location;
