import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';
import { TEMPLATE_KINDS } from './templates.constants.js';

/**
 * Uploaded Form 5 layout. Mapping is data: canonical field → {{placeholder}}
 * or Excel cell. Assignments live on this flag plus Client.template and
 * Location.defaultTemplate (client > location > global).
 */
const templateSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Template code is required'],
    trim: true,
    lowercase: true,
    maxlength: [64, 'Template code cannot exceed 64 characters'],
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [160, 'Template name cannot exceed 160 characters'],
  },
  kind: {
    type: String,
    enum: Object.values(TEMPLATE_KINDS),
    required: true,
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [180, 'Original name cannot exceed 180 characters'],
  },
  storedPath: {
    type: String,
    required: true,
    select: false,
  },
  mimetype: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
    min: 0,
  },
  sheetNames: {
    type: [String],
    default: [],
  },
  placeholders: {
    type: [String],
    default: [],
  },
  cells: {
    type: [
      {
        sheet: String,
        address: String,
        bind: String,
        value: String,
        tokens: [String],
      },
    ],
    default: [],
  },
  warnings: {
    type: [String],
    default: [],
  },
  mapping: {
    scalars: { type: mongoose.Schema.Types.Mixed, default: {} },
    slabs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  isGlobalDefault: {
    type: Boolean,
    default: false,
  },
  isBundled: {
    type: Boolean,
    default: false,
  },
});

templateSchema.plugin(auditPlugin);

templateSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
templateSchema.index({ isDeleted: 1, isGlobalDefault: 1 });
templateSchema.index({ isDeleted: 1, createdAt: -1 });

templateSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    delete ret.storedPath;
    return ret;
  },
});

const Template = mongoose.model('Template', templateSchema);

export default Template;
