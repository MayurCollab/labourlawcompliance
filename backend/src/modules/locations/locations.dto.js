export const toLocationDto = (location) => ({
  id: location.id,
  name: location.name,
  defaultTemplate: location.defaultTemplate
    ? typeof location.defaultTemplate === 'object' && location.defaultTemplate.id
      ? {
          id: location.defaultTemplate.id,
          name: location.defaultTemplate.name,
          code: location.defaultTemplate.code,
        }
      : { id: String(location.defaultTemplate), name: null, code: null }
    : null,
  createdAt: location.createdAt,
  updatedAt: location.updatedAt,
});

export const toLocationListDto = (locations) => locations.map(toLocationDto);

export const toLocationRefDto = (location) => {
  if (!location) return null;
  if (typeof location !== 'object' || location.name === undefined) {
    return { id: String(location), name: null };
  }
  return { id: location.id, name: location.name };
};
