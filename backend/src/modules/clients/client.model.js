import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';

/**
 * Employer client master. `clientCode` (e.g. C0001) is the stable business
 * key from MasterSheet. Monthly PT amounts live on filings, not here.
 */
const clientSchema = new mongoose.Schema({
  clientCode: {
    type: String,
    required: [true, 'Client code is required'],
    trim: true,
    uppercase: true,
    maxlength: [32, 'Client code cannot exceed 32 characters'],
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters'],
  },
  draftName: {
    type: String,
    trim: true,
    default: null,
    maxlength: [200, 'Draft name cannot exceed 200 characters'],
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: [true, 'Location is required'],
  },
  authorityName: {
    type: String,
    trim: true,
    default: null,
    maxlength: [200, 'Authority name cannot exceed 200 characters'],
  },
  address: {
    type: String,
    trim: true,
    default: null,
    maxlength: [500, 'Address cannot exceed 500 characters'],
  },
  rcNumber: {
    type: String,
    trim: true,
    default: null,
    maxlength: [64, 'Reg No. cannot exceed 64 characters'],
  },
  contactNumber: {
    type: String,
    trim: true,
    default: null,
    maxlength: [32, 'Contact number cannot exceed 32 characters'],
  },
  fundCode: {
    type: String,
    trim: true,
    default: null,
    maxlength: [32, 'Fund code cannot exceed 32 characters'],
  },
  phyCode: {
    type: String,
    trim: true,
    default: null,
    maxlength: [32, 'PHY code cannot exceed 32 characters'],
  },
  status: {
    type: String,
    trim: true,
    default: null,
    maxlength: [32, 'Status cannot exceed 32 characters'],
  },
  signatoryName: {
    type: String,
    trim: true,
    default: null,
    maxlength: [120, 'Signatory name cannot exceed 120 characters'],
  },
  includeEmployeesOnForm5: {
    type: Boolean,
    default: true,
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    default: null,
  },
});

clientSchema.plugin(auditPlugin);

clientSchema.index(
  { clientCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
clientSchema.index({ isDeleted: 1, createdAt: -1 });
clientSchema.index({ isDeleted: 1, companyName: 1 });
clientSchema.index({ isDeleted: 1, location: 1 });
clientSchema.index({ isDeleted: 1, fundCode: 1 });

clientSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const Client = mongoose.model('Client', clientSchema);

export default Client;
