const toMappingDto = (mapping) => ({
  scalars: mapping?.scalars || {},
  slabs: mapping?.slabs || [],
});

export const toTemplateListDto = (template, extras = {}) => ({
  id: template.id,
  code: template.code,
  name: template.name,
  kind: template.kind,
  originalName: template.originalName,
  size: template.size,
  isGlobalDefault: Boolean(template.isGlobalDefault),
  isBundled: Boolean(template.isBundled),
  placeholderCount: (template.placeholders || []).length,
  clientCount: extras.clientCount ?? 0,
  locationCount: extras.locationCount ?? 0,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

export const toTemplateDetailDto = (template, extras = {}) => ({
  ...toTemplateListDto(template, extras),
  mimetype: template.mimetype,
  sheetNames: template.sheetNames || [],
  placeholders: template.placeholders || [],
  cells: (template.cells || []).map((cell) => ({
    sheet: cell.sheet,
    address: cell.address,
    bind: cell.bind,
    value: cell.value,
    tokens: cell.tokens || [],
  })),
  warnings: template.warnings || [],
  mapping: toMappingDto(template.mapping),
  clients: extras.clients || [],
  locations: extras.locations || [],
});

export const toTemplateRefDto = (template) => {
  if (!template) return null;
  if (typeof template !== 'object' || template.name === undefined) {
    return { id: String(template), name: null, code: null, kind: null };
  }
  return {
    id: template.id,
    name: template.name,
    code: template.code,
    kind: template.kind || null,
  };
};

export const toTemplateList = (templates, extrasById = {}) =>
  templates.map((template) =>
    toTemplateListDto(template, extrasById[String(template.id)] || {}),
  );
