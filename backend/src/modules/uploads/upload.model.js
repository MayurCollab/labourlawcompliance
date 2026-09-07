import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';
import {
  UPLOAD_KINDS,
  UPLOAD_STATUSES,
} from './uploads.constants.js';

/**
 * Stored MasterSheet / salary workbook plus the last parse snapshot and
 * import report. The file on disk is the source of truth for re-preview
 * and import; preview rows are a convenience copy of the first N data rows.
 */
const uploadSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: Object.values(UPLOAD_KINDS),
    required: true,
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [180, 'Original filename cannot exceed 180 characters'],
  },
  storedPath: {
    type: String,
    required: true,
    trim: true,
    select: false,
  },
  mimetype: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: Object.values(UPLOAD_STATUSES),
    default: UPLOAD_STATUSES.UPLOADED,
  },
  sheetNames: {
    type: [String],
    default: [],
  },
  selectedSheet: {
    type: String,
    default: null,
  },
  headerRow: {
    type: Number,
    default: null,
  },
  headers: {
    type: [
      {
        _id: false,
        index: Number,
        label: String,
      },
    ],
    default: [],
  },
  mapping: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  fields: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  previewRows: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  previewRaw: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  warnings: {
    type: [String],
    default: [],
  },
  rowCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  report: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  error: {
    type: String,
    default: null,
    maxlength: [500, 'Error cannot exceed 500 characters'],
  },
  period: {
    type: String,
    default: null,
    match: [/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'],
  },
  suggestedPeriod: {
    type: String,
    default: null,
  },
  companyName: {
    type: String,
    trim: true,
    default: null,
    maxlength: [200, 'Company name cannot exceed 200 characters'],
  },
});

uploadSchema.plugin(auditPlugin);

uploadSchema.index({ isDeleted: 1, createdAt: -1 });
uploadSchema.index({ isDeleted: 1, kind: 1, createdAt: -1 });

uploadSchema.set('toJSON', {
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

const Upload = mongoose.model('Upload', uploadSchema);

export default Upload;
