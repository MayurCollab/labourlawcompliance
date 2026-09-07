import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { LOCATIONS_MESSAGES } from './locations.constants.js';
import * as locationsService from './locations.service.js';

export const listLocations = asyncHandler(async (_req, res) => {
  const locations = await locationsService.listLocations();
  return sendSuccess(res, { locations }, LOCATIONS_MESSAGES.FETCHED);
});

export const getLocation = asyncHandler(async (req, res) => {
  const location = await locationsService.getLocation(req.params.id);
  return sendSuccess(res, { location }, LOCATIONS_MESSAGES.FETCHED);
});

export const createLocation = asyncHandler(async (req, res) => {
  const location = await locationsService.createLocation(
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { location }, LOCATIONS_MESSAGES.CREATED, 201);
});

export const updateLocation = asyncHandler(async (req, res) => {
  const location = await locationsService.updateLocation(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { location }, LOCATIONS_MESSAGES.UPDATED);
});

export const deleteLocation = asyncHandler(async (req, res) => {
  await locationsService.deleteLocation(req.params.id, req.user.id);
  return sendSuccess(res, null, LOCATIONS_MESSAGES.DELETED);
});
