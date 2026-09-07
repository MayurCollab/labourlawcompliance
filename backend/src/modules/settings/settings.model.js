import mongoose from 'mongoose';

import auditPlugin from '../../database/plugins/auditPlugin.js';
import { SETTINGS_SINGLETON_KEY } from './settings.constants.js';

/**
 * Consultancy-wide defaults (one document). Signatory is empty until set —
 * never hardcode a person's name in code.
 */
const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    default: SETTINGS_SINGLETON_KEY,
  },
  signatoryName: {
    type: String,
    trim: true,
    default: '',
    maxlength: [120, 'Signatory name cannot exceed 120 characters'],
  },
});

settingsSchema.plugin(auditPlugin);

settingsSchema.index(
  { key: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

settingsSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
