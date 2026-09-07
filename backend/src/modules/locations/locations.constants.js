export const LOCATIONS_CODES = Object.freeze({
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  LOCATION_NAME_IN_USE: 'LOCATION_NAME_IN_USE',
  LOCATION_IN_USE: 'LOCATION_IN_USE',
});

export const LOCATIONS_MESSAGES = Object.freeze({
  CREATED: 'Location created successfully.',
  UPDATED: 'Location updated successfully.',
  DELETED: 'Location deleted successfully.',
  FETCHED: 'Locations fetched successfully.',
});

export const toLocationNameKey = (name) =>
  String(name ?? '')
    .trim()
    .toLowerCase();
