import AppError from '../../utils/AppError.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as templatesRepository from '../templates/templates.repository.js';
import { matchBundledTemplateCodeForLocation } from '../../templates/form5/bundledTemplates.constants.js';
import {
  LOCATIONS_CODES,
  toLocationNameKey,
} from './locations.constants.js';
import { toLocationDto, toLocationListDto } from './locations.dto.js';
import * as locationsRepository from './locations.repository.js';

const isDuplicateKey = (err) => err?.code === 11000;

/**
 * If this location has no saved template, attach the bundled Form 5
 * layout for that district. Does not overwrite a template the user set.
 */
export const assignBundledTemplateIfMissing = async (location) => {
  if (!location || location.defaultTemplate) return location;
  const code = matchBundledTemplateCodeForLocation(location.name);
  if (!code) return location;
  const template = await templatesRepository.findTemplateByCode(code);
  if (!template) return location;
  location.defaultTemplate = template.id;
  await locationsRepository.saveLocation(location);
  return location;
};

const findLocationOrFail = async (id) => {
  const location = await locationsRepository.findLocationById(id);
  if (!location) {
    throw new AppError('Location not found', 404, {
      code: LOCATIONS_CODES.LOCATION_NOT_FOUND,
    });
  }
  return location;
};

export const listLocations = async () => {
  const locations = await locationsRepository.findAllLocations();
  return toLocationListDto(locations);
};

export const getLocation = async (id) => {
  const location = await findLocationOrFail(id);
  return toLocationDto(location);
};

/**
 * Upsert by case-insensitive name. Used by client create/edit so typing
 * "Ahmedabad" reuses the existing place instead of duplicating it.
 */
export const findOrCreateByName = async (name, actorId, options = {}) => {
  const trimmed = sanitizeUserHtml(String(name ?? '').trim());
  const nameKey = toLocationNameKey(trimmed);

  if (!trimmed) {
    throw new AppError('Location name is required', 422, {
      code: LOCATIONS_CODES.LOCATION_NOT_FOUND,
    });
  }

  const existing = await locationsRepository.findLocationByNameKey(nameKey);
  if (existing) {
    await assignBundledTemplateIfMissing(existing);
    return { location: existing, created: false };
  }

  try {
    const location = await locationsRepository.createLocation({
      name: trimmed,
      nameKey,
      createdBy: actorId,
    });
    await assignBundledTemplateIfMissing(location);

    if (!options.silent) {
      await recordActivity({
        action: ACTIVITY_ACTIONS.LOCATION_CREATE,
        entityType: ENTITY_TYPES.LOCATION,
        entityId: location.id,
        changes: { name: trimmed },
      });
    }

    return { location, created: true };
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const raced = await locationsRepository.findLocationByNameKey(nameKey);
    if (!raced) throw err;
    return { location: raced, created: false };
  }
};

export const createLocation = async ({ name }, actorId) => {
  const { location, created } = await findOrCreateByName(name, actorId);
  if (!created) {
    throw new AppError('A location with this name already exists', 409, {
      code: LOCATIONS_CODES.LOCATION_NAME_IN_USE,
    });
  }
  return toLocationDto(location);
};

export const updateLocation = async (id, { name }, actorId) => {
  const location = await findLocationOrFail(id);
  const trimmed = sanitizeUserHtml(String(name).trim());
  const nameKey = toLocationNameKey(trimmed);

  if (nameKey !== location.nameKey) {
    const taken = await locationsRepository.findLocationByNameKey(nameKey);
    if (taken && String(taken.id) !== String(id)) {
      throw new AppError('A location with this name already exists', 409, {
        code: LOCATIONS_CODES.LOCATION_NAME_IN_USE,
      });
    }
    location.name = trimmed;
    location.nameKey = nameKey;
  }

  location.updatedBy = actorId;
  await locationsRepository.saveLocation(location);

  await recordActivity({
    action: ACTIVITY_ACTIONS.LOCATION_UPDATE,
    entityType: ENTITY_TYPES.LOCATION,
    entityId: location.id,
    changes: { name: location.name },
  });

  return toLocationDto(location);
};

export const deleteLocation = async (id, actorId) => {
  const location = await findLocationOrFail(id);
  const inUse = await clientsRepository.countClients({ location: location.id });
  if (inUse > 0) {
    throw new AppError(
      `Cannot delete location: ${inUse} client(s) still use it`,
      409,
      { code: LOCATIONS_CODES.LOCATION_IN_USE },
    );
  }

  await location.softDelete(actorId);
  await recordActivity({
    action: ACTIVITY_ACTIONS.LOCATION_SOFT_DELETE,
    entityType: ENTITY_TYPES.LOCATION,
    entityId: location.id,
    changes: { name: location.name },
  });
};
