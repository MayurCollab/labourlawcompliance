import Settings from './settings.model.js';
import { SETTINGS_SINGLETON_KEY } from './settings.constants.js';

export const findSettings = () => Settings.findOne({ key: SETTINGS_SINGLETON_KEY });

export const upsertSettings = (set, setOnInsert = {}) => {
  const insertOnly = { key: SETTINGS_SINGLETON_KEY, ...setOnInsert };
  for (const field of Object.keys(set)) {
    delete insertOnly[field];
  }
  return Settings.findOneAndUpdate(
    { key: SETTINGS_SINGLETON_KEY },
    { $set: set, $setOnInsert: insertOnly },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const saveSettings = (settings) => settings.save();
