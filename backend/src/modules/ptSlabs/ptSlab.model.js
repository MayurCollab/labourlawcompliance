import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * Effective-dated PT slab row. Open-ended bands use salaryTo = null
 * (e.g. Rs. 12,000 and above). Generator maps by from/to/rate, not row index.
 */
const ptSlabSchema = new mongoose.Schema({
  salaryFrom: {
    type: Number,
    required: [true, 'salaryFrom is required'],
    min: [0, 'salaryFrom cannot be negative'],
  },
  salaryTo: {
    type: Number,
    default: null,
    min: [0, 'salaryTo cannot be negative'],
  },
  rate: {
    type: Number,
    required: [true, 'rate is required'],
    min: [0, 'rate cannot be negative'],
  },
  label: {
    type: String,
    trim: true,
    default: '',
    maxlength: [80, 'Label cannot exceed 80 characters'],
  },
  effectiveFrom: {
    type: Date,
    required: [true, 'effectiveFrom is required'],
  },
  effectiveTo: {
    type: Date,
    default: null,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
});

ptSlabSchema.plugin(auditPlugin);

ptSlabSchema.index({ isDeleted: 1, effectiveFrom: 1, salaryFrom: 1 });
ptSlabSchema.index({ isDeleted: 1, sortOrder: 1, salaryFrom: 1 });

ptSlabSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const PtSlab = mongoose.model('PtSlab', ptSlabSchema);

export default PtSlab;
