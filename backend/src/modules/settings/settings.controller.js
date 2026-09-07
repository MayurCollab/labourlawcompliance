import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { SETTINGS_MESSAGES } from './settings.constants.js';
import * as settingsService from './settings.service.js';

export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await settingsService.getSettings();
  return sendSuccess(res, { settings }, SETTINGS_MESSAGES.FETCHED);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { settings }, SETTINGS_MESSAGES.UPDATED);
});
