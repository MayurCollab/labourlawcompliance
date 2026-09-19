import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';
import { WHATSAPP_TEMPLATE_FIELD_KEYS } from './whatsappTemplates.constants.js';

/**
 * Local record of an already-approved MSG91 / WhatsApp template. It stores how
 * to call the template (name + namespace + language) and how our data maps into
 * its positional body variables. Array order of `variables` is body_1..body_N.
 * `bodyPreview` is reference text only and is never sent to MSG91.
 */
const whatsappTemplateSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Template label is required'],
    trim: true,
    maxlength: [120, 'Label cannot exceed 120 characters'],
  },
  msg91TemplateName: {
    type: String,
    required: [true, 'MSG91 template name is required'],
    trim: true,
    maxlength: [120, 'MSG91 template name cannot exceed 120 characters'],
  },
  namespace: {
    type: String,
    required: [true, 'Namespace is required'],
    trim: true,
    maxlength: [120, 'Namespace cannot exceed 120 characters'],
  },
  languageCode: {
    type: String,
    trim: true,
    default: 'en',
    maxlength: [16, 'Language code cannot exceed 16 characters'],
  },
  bodyPreview: {
    type: String,
    trim: true,
    default: '',
    maxlength: [1024, 'Body preview cannot exceed 1024 characters'],
  },
  variables: {
    type: [
      {
        _id: false,
        field: {
          type: String,
          enum: WHATSAPP_TEMPLATE_FIELD_KEYS,
          required: true,
        },
      },
    ],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  /** Marks the record migrated from the old hardcoded config so re-seeding is idempotent. */
  isSeeded: {
    type: Boolean,
    default: false,
  },
});

whatsappTemplateSchema.plugin(auditPlugin);

whatsappTemplateSchema.index({ isDeleted: 1, isActive: 1, label: 1 });
whatsappTemplateSchema.index({ isDeleted: 1, createdAt: -1 });

whatsappTemplateSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const WhatsAppTemplate = mongoose.model(
  'WhatsAppTemplate',
  whatsappTemplateSchema,
);

export default WhatsAppTemplate;
