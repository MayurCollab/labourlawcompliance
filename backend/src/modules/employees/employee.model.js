import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * One employee for one month. PHY_CODE is optional; unmatched rows (no Client)
 * are kept with client = null — never dropped.
 */
const employeeSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
  },
  clientCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    maxlength: [32, 'Client code cannot exceed 32 characters'],
  },
  employeeNo: {
    type: String,
    required: [true, 'EMPNO is required'],
    trim: true,
    maxlength: [64, 'EMPNO cannot exceed 64 characters'],
  },
  employeeName: {
    type: String,
    trim: true,
    default: null,
    maxlength: [200, 'Employee name cannot exceed 200 characters'],
  },
  phyCode: {
    type: String,
    trim: true,
    default: '',
    maxlength: [32, 'PHY_CODE cannot exceed 32 characters'],
  },
  period: {
    type: String,
    required: [true, 'Period is required'],
    match: [/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'],
  },
  periodLabel: {
    type: String,
    trim: true,
    default: null,
    maxlength: [80, 'Period label cannot exceed 80 characters'],
  },
  locationName: {
    type: String,
    trim: true,
    default: null,
    maxlength: [120, 'Location cannot exceed 120 characters'],
  },
  state: {
    type: String,
    trim: true,
    default: null,
    maxlength: [80, 'State cannot exceed 80 characters'],
  },
  ptGross: {
    type: Number,
    default: null,
    min: [0, 'PT GROSS cannot be negative'],
  },
  pTax: {
    type: Number,
    default: null,
    min: [0, 'P_TAX cannot be negative'],
  },
  unmatched: {
    type: Boolean,
    default: false,
  },
  unmatchedReason: {
    type: String,
    trim: true,
    default: null,
    maxlength: [240, 'Unmatched reason cannot exceed 240 characters'],
  },
  upload: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload',
    default: null,
  },
});

employeeSchema.plugin(auditPlugin);

employeeSchema.index(
  { employeeNo: 1, phyCode: 1, period: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
employeeSchema.index({ isDeleted: 1, period: 1, client: 1 });
employeeSchema.index({ isDeleted: 1, unmatched: 1, period: 1 });
employeeSchema.index({ isDeleted: 1, clientCode: 1, period: 1 });
employeeSchema.index({ isDeleted: 1, createdAt: -1 });

employeeSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;
