import mongoose from 'mongoose';

import { WHATSAPP_SEND_STATUS_VALUES } from './whatsappSends.constants.js';

/**
 * Outbound WhatsApp send ledger (Form 5 via MSG91).
 * Mutable for delivery/read webhook updates; create path is fire-and-forget
 * from filings so a logging failure never blocks the live send.
 */
const whatsappSendSchema = new mongoose.Schema(
  {
    filing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Filing',
      default: null,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    clientCode: {
      type: String,
      trim: true,
      default: null,
      maxlength: [40, 'Client code cannot exceed 40 characters'],
    },
    companyName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
      index: true,
    },
    period: {
      type: String,
      trim: true,
      default: null,
      match: [/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'],
      index: true,
    },
    periodLabel: {
      type: String,
      trim: true,
      default: null,
      maxlength: [40, 'Period label cannot exceed 40 characters'],
    },
    filename: {
      type: String,
      trim: true,
      default: null,
      maxlength: [255, 'Filename cannot exceed 255 characters'],
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2048, 'Media URL cannot exceed 2048 characters'],
    },
    templateName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [120, 'Template name cannot exceed 120 characters'],
    },
    status: {
      type: String,
      enum: WHATSAPP_SEND_STATUS_VALUES,
      default: 'accepted',
      index: true,
    },
    /** MSG91 request id — primary webhook correlation key. */
    requestId: {
      type: String,
      trim: true,
      default: null,
      index: true,
      maxlength: [120, 'requestId cannot exceed 120 characters'],
    },
    /** Meta wamid / MSG91 message uuid when available. */
    providerMessageId: {
      type: String,
      trim: true,
      default: null,
      index: true,
      maxlength: [256, 'providerMessageId cannot exceed 256 characters'],
    },
    errorMessage: {
      type: String,
      trim: true,
      default: null,
      maxlength: [500, 'Error message cannot exceed 500 characters'],
    },
    /** Sanitized subset of the MSG91 accept response (ids + status only). */
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    statusUpdatedAt: {
      type: Date,
      default: null,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorEmail: {
      type: String,
      trim: true,
      default: null,
      maxlength: [254, 'Actor email cannot exceed 254 characters'],
    },
  },
  {
    timestamps: true,
  },
);

whatsappSendSchema.index({ sentAt: -1 });
whatsappSendSchema.index({ status: 1, sentAt: -1 });
whatsappSendSchema.index({ client: 1, sentAt: -1 });
whatsappSendSchema.index({ period: 1, sentAt: -1 });
whatsappSendSchema.index({ requestId: 1, sentAt: -1 });
whatsappSendSchema.index({ providerMessageId: 1, sentAt: -1 });

whatsappSendSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const WhatsAppSend = mongoose.model('WhatsAppSend', whatsappSendSchema);

export default WhatsAppSend;
