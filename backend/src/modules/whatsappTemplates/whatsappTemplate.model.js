import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';
import {
  CUSTOM_TOKEN_REGEX,
  WHATSAPP_BODY_MODES,
  WHATSAPP_BODY_MODE_VALUES,
  WHATSAPP_TEMPLATE_FIELD_KEYS,
  WHATSAPP_VARIABLE_TYPES,
  WHATSAPP_VARIABLE_TYPE_VALUES,
} from './whatsappTemplates.constants.js';

/**
 * One positional body variable. `type` decides where its value comes from:
 * a data field, or free text the operator types at send time.
 *
 * `type` defaults to 'field' so templates stored before custom text existed
 * keep resolving exactly as they did — no migration needed.
 */
const whatsappTemplateVariableSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: WHATSAPP_VARIABLE_TYPE_VALUES,
      default: WHATSAPP_VARIABLE_TYPES.FIELD,
      required: true,
    },
    /** Data field to read — `field` variables only. */
    field: {
      type: String,
      enum: WHATSAPP_TEMPLATE_FIELD_KEYS,
    },
    /** Admin-facing name for the input shown at send time — `custom` variables only. */
    label: {
      type: String,
      trim: true,
      maxlength: [60, 'Variable label cannot exceed 60 characters'],
    },
    /** Placeholder in the body, e.g. `{{CustomText1}}` — `custom` variables only. */
    token: {
      type: String,
      trim: true,
      maxlength: [60, 'Variable token cannot exceed 60 characters'],
    },
  },
  { _id: false },
);

whatsappTemplateVariableSchema.pre('validate', function validateVariable(next) {
  if (this.type === WHATSAPP_VARIABLE_TYPES.CUSTOM) {
    this.field = undefined;
    if (!this.label) {
      return next(new Error('A custom variable needs a label'));
    }
    if (!CUSTOM_TOKEN_REGEX.test(this.token || '')) {
      return next(new Error('A custom variable needs a {{Token}} placeholder'));
    }
    return next();
  }

  this.label = undefined;
  this.token = undefined;
  if (!this.field) {
    return next(new Error('A field variable needs a field'));
  }
  return next();
});

/**
 * Local record of an already-approved MSG91 / WhatsApp template. MSG91 is the
 * WhatsApp service provider; templates are approved in their dashboard, never
 * from here. This record only stores which approved template to call
 * (name + namespace + language) and what goes into its positional body
 * variables. Array order of `variables` is body_1..body_N and must match what
 * the provider approved. `bodyPreview` is reference text only and is never sent.
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
    type: [whatsappTemplateVariableSchema],
    default: [],
  },
  /**
   * How `variables` map onto MSG91's body slots. Defaults to 'positional' so
   * templates stored before 'single' existed (Template 1) keep resolving
   * exactly as they did — see WHATSAPP_BODY_MODES.
   */
  bodyMode: {
    type: String,
    enum: WHATSAPP_BODY_MODE_VALUES,
    default: WHATSAPP_BODY_MODES.POSITIONAL,
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
