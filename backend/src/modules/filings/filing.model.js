import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';
import { GENERATE_STATUSES } from './filings.constants.js';

/**
 * Monthly Form 5 filing stub. Master identity lives on Client; PT amount,
 * challan, and generate output belong here keyed by client + period.
 */
const filingSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required'],
  },
  clientCode: {
    type: String,
    required: [true, 'Client code is required'],
    trim: true,
    uppercase: true,
    maxlength: [32, 'Client code cannot exceed 32 characters'],
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
    maxlength: [32, 'Period label cannot exceed 32 characters'],
  },
  status: {
    type: String,
    trim: true,
    default: null,
    maxlength: [32, 'Status cannot exceed 32 characters'],
  },
  taskNo: {
    type: String,
    trim: true,
    default: null,
    maxlength: [64, 'Task No. cannot exceed 64 characters'],
  },
  ptAmount: {
    type: Number,
    default: null,
    min: [0, 'P.Tax amount cannot be negative'],
  },
  chequeNo: {
    type: String,
    trim: true,
    default: null,
    maxlength: [64, 'Cheque No. cannot exceed 64 characters'],
  },
  sentDate: {
    type: Date,
    default: null,
  },
  challanNo: {
    type: String,
    trim: true,
    default: null,
    maxlength: [64, 'Challan No. cannot exceed 64 characters'],
  },
  challanDate: {
    type: Date,
    default: null,
  },
  receivedInBank: {
    type: String,
    trim: true,
    default: null,
    maxlength: [120, 'Received In Bank cannot exceed 120 characters'],
  },
  lessPaymentReceived: {
    type: String,
    trim: true,
    default: null,
    maxlength: [120, 'Less Payment Received cannot exceed 120 characters'],
  },
  link: {
    type: String,
    trim: true,
    default: null,
    maxlength: [500, 'Link cannot exceed 500 characters'],
  },
  mailStatus: {
    type: String,
    trim: true,
    default: null,
    maxlength: [120, 'Mail Status cannot exceed 120 characters'],
  },
  originalChallanStatus: {
    type: String,
    trim: true,
    default: null,
    maxlength: [120, 'Original challan status cannot exceed 120 characters'],
  },
  generateStatus: {
    type: String,
    enum: Object.values(GENERATE_STATUSES),
    default: GENERATE_STATUSES.PENDING,
  },
  generateOverrides: {
    type: {
      employerAddress: {
        type: String,
        trim: true,
        default: null,
        maxlength: [500, 'Employer address cannot exceed 500 characters'],
      },
      signatoryName: {
        type: String,
        trim: true,
        default: null,
        maxlength: [120, 'Signatory name cannot exceed 120 characters'],
      },
      filingDate: {
        type: Date,
        default: null,
      },
      additionalTaxPayable: {
        type: Number,
        default: null,
        min: [0, 'Additional tax cannot be negative'],
      },
    },
    default: null,
  },
  computation: {
    type: {
      slabs: {
        type: [
          {
            label: { type: String, default: '' },
            salaryFrom: { type: Number, required: true },
            salaryTo: { type: Number, default: null },
            rate: { type: Number, required: true },
            employeeCount: { type: Number, default: 0 },
            exemptCount: { type: Number, default: 0 },
            taxableCount: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
          },
        ],
        default: [],
      },
      totalA: { type: Number, default: 0 },
      totalB: { type: Number, default: 0 },
      interest: { type: Number, default: 0 },
      totalPayable: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
      taxableEmployeeCount: { type: Number, default: 0 },
      exemptEmployeeCount: { type: Number, default: 0 },
      unmatchedExcluded: { type: Number, default: 0 },
      unslottedCount: { type: Number, default: 0 },
      varianceCount: { type: Number, default: 0 },
      variances: {
        type: [
          {
            employeeNo: { type: String, default: '' },
            ptGross: { type: Number, default: null },
            sheetPTax: { type: Number, default: null },
            computedRate: { type: Number, default: null },
          },
        ],
        default: [],
      },
      computedAt: { type: Date, default: null },
    },
    default: null,
  },
  generatedFile: {
    type: {
      version: { type: Number, default: 1 },
      filename: { type: String, default: '' },
      storedPath: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template',
        default: null,
      },
      templateName: { type: String, default: '' },
      templateCode: { type: String, default: '' },
      source: { type: String, default: null },
      generatedAt: { type: Date, default: null },
    },
    default: null,
  },
  generatedHistory: {
    type: [
      {
        version: { type: Number, default: 1 },
        filename: { type: String, default: '' },
        storedPath: { type: String, default: '' },
        mimetype: { type: String, default: '' },
        size: { type: Number, default: 0 },
        template: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Template',
          default: null,
        },
        templateName: { type: String, default: '' },
        templateCode: { type: String, default: '' },
        source: { type: String, default: null },
        generatedAt: { type: Date, default: null },
      },
    ],
    default: [],
  },
});

filingSchema.plugin(auditPlugin);

filingSchema.index(
  { client: 1, period: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
filingSchema.index({ isDeleted: 1, period: 1, clientCode: 1 });
filingSchema.index({ isDeleted: 1, createdAt: -1 });

filingSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const Filing = mongoose.model('Filing', filingSchema);

export default Filing;
