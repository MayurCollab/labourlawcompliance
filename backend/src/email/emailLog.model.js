import mongoose from 'mongoose';

/**
 * Audit trail for outbound email jobs (BullMQ).
 * One document per recipient/job attempt chain.
 */
const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    template: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'active', 'sent', 'failed'],
      default: 'queued',
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    jobId: { type: String, default: null },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Worker updates look a log up by its BullMQ job id
emailLogSchema.index({ jobId: 1 }, { sparse: true });

// Operational queries: "what failed recently", "what did we send this user"
emailLogSchema.index({ status: 1, createdAt: -1 });
emailLogSchema.index({ to: 1, createdAt: -1 });
emailLogSchema.index({ userId: 1, createdAt: -1 }, { sparse: true });

const EmailLog = mongoose.model('EmailLog', emailLogSchema);

export default EmailLog;
