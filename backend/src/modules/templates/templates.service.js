import AppError from '../../utils/AppError.js';
import storage from '../../storage/index.js';
import { readBundledTemplateBuffer, isBundledStoredPath } from '../../templates/form5/readBundledTemplate.js';
import { BUNDLED_FORM5_BY_CODE } from '../../templates/form5/bundledTemplates.constants.js';
import { sampleForm5PreviewValues } from '../../templates/form5/samplePreviewValues.js';
import { fillHtmlTemplate } from './htmlFill.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as locationsRepository from '../locations/locations.repository.js';
import * as ptSlabsService from '../ptSlabs/ptSlabs.service.js';
import { emptyMapping } from './canonicalFields.js';
import { canonicalSchema } from './canonicalFields.js';
import {
  parseAnyTemplate,
  slugFromFilename,
  templateKindFromName,
} from './templateParse.js';
import {
  ASSIGNMENT_SCOPES,
  TEMPLATES_CODES,
} from './templates.constants.js';
import {
  toTemplateDetailDto,
  toTemplateList,
  toTemplateRefDto,
} from './templates.dto.js';
import * as templatesRepository from './templates.repository.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findTemplateOrFail = async (id, { withPath = false } = {}) => {
  const template = withPath
    ? await templatesRepository.findTemplateByIdWithPath(id)
    : await templatesRepository.findTemplateById(id);
  if (!template) {
    throw new AppError('Template not found', 404, {
      code: TEMPLATES_CODES.TEMPLATE_NOT_FOUND,
    });
  }
  return template;
};

const uniqueCode = async (desired) => {
  let code = desired;
  let n = 2;
  while (await templatesRepository.findTemplateByCode(code)) {
    const suffix = `-${n}`;
    code = `${desired.slice(0, 64 - suffix.length)}${suffix}`;
    n += 1;
    if (n > 50) {
      throw new AppError('Could not allocate a unique template code', 409, {
        code: TEMPLATES_CODES.CODE_IN_USE,
      });
    }
  }
  return code;
};

const assignmentExtras = async (templateId) => {
  const [clients, locations] = await Promise.all([
    clientsRepository.findClientsByTemplate(templateId),
    locationsRepository.findLocationsByTemplate(templateId),
  ]);
  return {
    clientCount: clients.length,
    locationCount: locations.length,
    clients: clients.map((client) => ({
      id: client.id,
      clientCode: client.clientCode,
      companyName: client.companyName,
    })),
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
  };
};

const currentSlabs = async () => {
  const slabs = await ptSlabsService.listEffectiveSlabs(new Date());
  return slabs.map((slab) => ({
    salaryFrom: slab.salaryFrom,
    salaryTo: slab.salaryTo ?? null,
    rate: slab.rate,
    label: slab.label,
  }));
};

export const listCanonical = () => canonicalSchema();

/**
 * Read template source bytes — bundled templates from repo, uploads from storage.
 */
export const readTemplateBuffer = async (template) => {
  if (template?.isBundled || isBundledStoredPath(template?.storedPath)) {
    const code =
      template?.code ||
      String(template?.storedPath || '').replace(/^bundled:/, '');
    return readBundledTemplateBuffer(code);
  }
  return storage.readFileBuffer(template.storedPath);
};

export const listBundledTemplates = async () => {
  const templates = await templatesRepository.findBundledTemplates();
  return templates.map((template) => ({
    id: template.id,
    code: template.code,
    name: template.name,
    kind: template.kind,
    isGlobalDefault: Boolean(template.isGlobalDefault),
    locationNames:
      BUNDLED_FORM5_BY_CODE.get(template.code)?.locationNames || [],
  }));
};

export const previewBundledTemplate = async (code) => {
  const definition = BUNDLED_FORM5_BY_CODE.get(code);
  if (!definition) {
    throw new AppError('Bundled Form 5 template not found', 404, {
      code: TEMPLATES_CODES.TEMPLATE_NOT_FOUND,
    });
  }
  const buffer = await readBundledTemplateBuffer(code);
  const html = await fillHtmlTemplate(
    buffer.toString('utf8'),
    sampleForm5PreviewValues(),
  );
  return {
    code,
    name: definition.name,
    html,
  };
};

export const listTemplates = async (query) => {
  const { page, limit, search, sortBy, sortOrder } = query;
  const filter = {};
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: regex }, { code: regex }, { originalName: regex }];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const [templates, total] = await Promise.all([
    templatesRepository.findTemplates(filter, { sort, skip, limit }),
    templatesRepository.countTemplates(filter),
  ]);

  const extrasById = {};
  await Promise.all(
    templates.map(async (template) => {
      extrasById[String(template.id)] = await assignmentExtras(template.id);
    }),
  );

  return {
    templates: toTemplateList(templates, extrasById),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getTemplate = async (id) => {
  const template = await findTemplateOrFail(id);
  return toTemplateDetailDto(template, await assignmentExtras(template.id));
};

export const createTemplate = async ({ file, name, code }, actorId) => {
  if (!file?.buffer) {
    throw new AppError('A template file is required', 422, {
      code: TEMPLATES_CODES.FILE_REQUIRED,
    });
  }

  const kind = templateKindFromName(file.originalname);
  if (!kind) {
    throw new AppError(
      'Template must be Excel (.xlsx, .xlsm, .xls), Word (.docx), HTML (.html), or PDF (.pdf).',
      422,
      { code: TEMPLATES_CODES.INVALID_KIND },
    );
  }

  const stored = await storage.saveDocument({
    buffer: file.buffer,
    mimetype: file.mimetype,
    folder: 'templates',
    originalName: file.originalname,
  });

  let parsed;
  try {
    parsed = await parseAnyTemplate(
      file.buffer,
      stored.originalName,
      await currentSlabs(),
    );
  } catch (error) {
    await storage.deleteFile(stored.path);
    throw new AppError(error.message || 'Could not parse this template', 422, {
      code: TEMPLATES_CODES.INVALID_KIND,
    });
  }

  const displayName =
    (name && String(name).trim()) ||
    stored.originalName.replace(/\.[^.]+$/, '');
  const desiredCode = (code && String(code).trim()) || slugFromFilename(stored.originalName);
  const unique = await uniqueCode(desiredCode);

  const template = await templatesRepository.createTemplate({
    code: unique,
    name: displayName,
    kind: parsed.kind,
    originalName: stored.originalName,
    storedPath: stored.path,
    mimetype: stored.mimetype,
    size: stored.size,
    sheetNames: parsed.sheetNames,
    placeholders: parsed.placeholders,
    cells: parsed.cells,
    warnings: parsed.warnings,
    mapping: parsed.mapping,
    createdBy: actorId,
  });

  await recordActivity({
    action: ACTIVITY_ACTIONS.TEMPLATE_CREATE,
    entityType: ENTITY_TYPES.TEMPLATE,
    entityId: template.id,
    changes: { code: unique, name: displayName, kind: parsed.kind },
  });

  return toTemplateDetailDto(template, await assignmentExtras(template.id));
};

export const updateTemplate = async (id, data, actorId) => {
  const template = await findTemplateOrFail(id);
  if (data.name !== undefined) template.name = data.name;
  if (data.mapping !== undefined) {
    template.mapping = {
      scalars: { ...emptyMapping().scalars, ...data.mapping.scalars },
      slabs: data.mapping.slabs || template.mapping.slabs,
    };
  }
  template.updatedBy = actorId;
  await templatesRepository.saveTemplate(template);

  await recordActivity({
    action: ACTIVITY_ACTIONS.TEMPLATE_UPDATE,
    entityType: ENTITY_TYPES.TEMPLATE,
    entityId: template.id,
    changes: {
      name: template.name,
      mappedScalars: Object.values(template.mapping?.scalars || {}).filter(
        Boolean,
      ).length,
    },
  });

  return toTemplateDetailDto(template, await assignmentExtras(template.id));
};

export const deleteTemplate = async (id, actorId) => {
  const template = await findTemplateOrFail(id, { withPath: true });
  if (template.isBundled) {
    throw new AppError(
      'Bundled Form 5 templates cannot be deleted. They ship with the application.',
      422,
      { code: TEMPLATES_CODES.INVALID_KIND },
    );
  }
  await Promise.all([
    clientsRepository.clearClientTemplateRefs(id),
    locationsRepository.clearLocationTemplateRefs(id),
  ]);
  await template.softDelete(actorId);
  await storage.deleteFile(template.storedPath);

  await recordActivity({
    action: ACTIVITY_ACTIONS.TEMPLATE_SOFT_DELETE,
    entityType: ENTITY_TYPES.TEMPLATE,
    entityId: template.id,
    changes: { code: template.code, name: template.name },
  });
};

export const assignTemplate = async (id, body, actorId) => {
  const template = await findTemplateOrFail(id);
  const clear = Boolean(body.clear);

  if (body.scope === ASSIGNMENT_SCOPES.GLOBAL) {
    template.isGlobalDefault = !clear;
    template.updatedBy = actorId;
    if (!clear) {
      await templatesRepository.clearOtherGlobalDefaults(template.id);
    }
    await templatesRepository.saveTemplate(template);
  }

  if (body.scope === ASSIGNMENT_SCOPES.LOCATION) {
    const location = await locationsRepository.findLocationById(body.locationId);
    if (!location) {
      throw new AppError('Location not found', 404, {
        code: TEMPLATES_CODES.LOCATION_NOT_FOUND,
      });
    }
    location.defaultTemplate = clear ? null : template.id;
    location.updatedBy = actorId;
    await locationsRepository.saveLocation(location);
  }

  if (body.scope === ASSIGNMENT_SCOPES.CLIENT) {
    const client = await clientsRepository.findClientById(body.clientId);
    if (!client) {
      throw new AppError('Client not found', 404, {
        code: TEMPLATES_CODES.CLIENT_NOT_FOUND,
      });
    }
    client.template = clear ? null : template.id;
    client.updatedBy = actorId;
    await clientsRepository.saveClient(client);
  }

  await recordActivity({
    action: ACTIVITY_ACTIONS.TEMPLATE_ASSIGN,
    entityType: ENTITY_TYPES.TEMPLATE,
    entityId: template.id,
    changes: {
      scope: body.scope,
      clear,
      locationId: body.locationId || null,
      clientId: body.clientId || null,
    },
  });

  return toTemplateDetailDto(
    await findTemplateOrFail(id),
    await assignmentExtras(id),
  );
};

/**
 * Client saved template, then location default, then global default.
 */
export const resolveTemplate = async (clientId) => {
  const client = await clientsRepository.findClientForTemplateResolve(clientId);
  if (!client) {
    throw new AppError('Client not found', 404, {
      code: TEMPLATES_CODES.CLIENT_NOT_FOUND,
    });
  }

  if (client.template) {
    return {
      source: ASSIGNMENT_SCOPES.CLIENT,
      template: toTemplateRefDto(client.template),
      mapping: client.template.mapping || null,
    };
  }

  const locationTemplate = client.location?.defaultTemplate;
  if (locationTemplate) {
    const detail = await templatesRepository.findTemplateById(
      locationTemplate.id || locationTemplate,
    );
    return {
      source: ASSIGNMENT_SCOPES.LOCATION,
      template: toTemplateRefDto(detail || locationTemplate),
      mapping: detail?.mapping || null,
    };
  }

  const global = await templatesRepository.findGlobalDefault();
  if (global) {
    return {
      source: ASSIGNMENT_SCOPES.GLOBAL,
      template: toTemplateRefDto(global),
      mapping: global.mapping || null,
    };
  }

  return { source: null, template: null, mapping: null };
};
