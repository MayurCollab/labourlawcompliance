import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { ACTIVITY_MESSAGES } from './activity.constants.js';
import * as activityService from './activity.service.js';

/**
 * GET /api/v1/activity
 * Read-only. This module deliberately exposes no create/update/delete
 * endpoints — records are written by services, never by clients.
 */
export const listActivity = asyncHandler(async (req, res) => {
  const result = await activityService.listActivity(req.query);
  return sendSuccess(res, result, ACTIVITY_MESSAGES.FETCHED);
});
