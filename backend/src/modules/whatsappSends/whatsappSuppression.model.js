import mongoose from 'mongoose';

/**
 * Recipients who must never receive another marketing WhatsApp template —
 * checked before every send. Keyed globally by phone (Meta's opt-out is tied
 * to the recipient's WhatsApp account, not a specific client record).
 */
const whatsappSuppressionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      unique: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    reason: {
      type: String,
      enum: ['opted_out', 'manual'],
      default: 'opted_out',
    },
    sourceSend: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppSend',
      default: null,
    },
    failureCode: {
      type: String,
      trim: true,
      default: null,
      maxlength: [12, 'Failure code cannot exceed 12 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    suppressedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

whatsappSuppressionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const WhatsAppSuppression = mongoose.model(
  'WhatsAppSuppression',
  whatsappSuppressionSchema,
);

export default WhatsAppSuppression;
