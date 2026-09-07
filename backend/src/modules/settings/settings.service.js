import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as settingsRepository from './settings.repository.js';

export const toSettingsDto = (settings) => ({
  signatoryName: settings?.signatoryName ?? '',
});

export const getSettings = async () => {
  const existing = await settingsRepository.findSettings();
  if (existing) return toSettingsDto(existing);

  const created = await settingsRepository.upsertSettings(
    {},
    { signatoryName: '' },
  );
  return toSettingsDto(created);
};

export const updateSettings = async ({ signatoryName }, actorId) => {
  const cleaned = sanitizeUserHtml(signatoryName ?? '');
  const settings = await settingsRepository.upsertSettings(
    { signatoryName: cleaned, updatedBy: actorId },
    { createdBy: actorId },
  );

  await recordActivity({
    action: ACTIVITY_ACTIONS.SETTINGS_UPDATE,
    entityType: ENTITY_TYPES.SETTINGS,
    entityId: settings.id,
    changes: { signatoryName: cleaned },
  });

  return toSettingsDto(settings);
};
