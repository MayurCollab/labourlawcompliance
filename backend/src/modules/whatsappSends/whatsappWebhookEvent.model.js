import mongoose from 'mongoose';

/**
 * Dedup ledger for MSG91 webhook deliveries. MSG91 documents duplicate
 * webhook events for the same WAMID as expected behavior — we dedupe by
 * (providerMessageId, eventName) before applying any status change or
 * scheduling a retry, so a duplicate delivery never double-processes.
 * Insert-first: a duplicate-key error on create IS the dedupe check.
 */
const whatsappWebhookEventSchema = new mongoose.Schema({
  providerMessageId: {
    type: String,
    required: true,
    trim: true,
    maxlength: [256, 'providerMessageId cannot exceed 256 characters'],
  },
  eventName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [40, 'eventName cannot exceed 40 characters'],
  },
  receivedAt: {
    type: Date,
    default: Date.now,
  },
});

whatsappWebhookEventSchema.index(
  { providerMessageId: 1, eventName: 1 },
  { unique: true },
);
// Keep the dedup ledger small — 60 days is well beyond any retry window.
whatsappWebhookEventSchema.index(
  { receivedAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 },
);

const WhatsAppWebhookEvent = mongoose.model(
  'WhatsAppWebhookEvent',
  whatsappWebhookEventSchema,
);

export default WhatsAppWebhookEvent;
