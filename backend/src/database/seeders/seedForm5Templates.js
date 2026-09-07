import { parseTemplateFile } from '../../modules/templates/templateParse.js';
import { emptyMapping } from '../../modules/templates/canonicalFields.js';
import { GUJARAT_DEFAULT_SLABS } from '../../modules/ptSlabs/ptSlabs.constants.js';
import Location from '../../modules/locations/location.model.js';
import Template from '../../modules/templates/template.model.js';
import * as templatesRepository from '../../modules/templates/templates.repository.js';
import logger from '../../utils/logger.js';
import {
  BUNDLED_FORM5_TEMPLATES,
  bundledStoredPath,
} from '../../templates/form5/bundledTemplates.constants.js';
import { readBundledTemplateBuffer } from '../../templates/form5/readBundledTemplate.js';

const locationNameKey = (name) =>
  String(name || '')
    .trim()
    .toLowerCase();

const seedSlabShape = () =>
  GUJARAT_DEFAULT_SLABS.map((slab) => ({
    salaryFrom: slab.salaryFrom,
    salaryTo: slab.salaryTo ?? null,
    rate: slab.rate,
    label: slab.label,
  }));

export const seedForm5BundledTemplates = async () => {
  const slabs = seedSlabShape();
  const templateByCode = new Map();

  for (const definition of BUNDLED_FORM5_TEMPLATES) {
    const buffer = await readBundledTemplateBuffer(definition.code);
    let parsed;
    try {
      parsed = parseTemplateFile(buffer, definition.originalName, slabs);
    } catch (error) {
      logger.warn(
        `[seed] Could not parse bundled template ${definition.code}: ${error.message}`,
      );
      parsed = {
        kind: 'html',
        sheetNames: [],
        placeholders: [],
        cells: [],
        warnings: [],
        mapping: emptyMapping(slabs),
      };
    }

    const existing = await Template.findOne({ code: definition.code });
    const payload = {
      code: definition.code,
      name: definition.name,
      kind: 'html',
      originalName: definition.originalName,
      storedPath: bundledStoredPath(definition.code),
      mimetype: 'text/html; charset=utf-8',
      size: buffer.length,
      sheetNames: parsed.sheetNames || [],
      placeholders: parsed.placeholders || [],
      cells: parsed.cells || [],
      warnings: parsed.warnings || [],
      mapping: parsed.mapping || emptyMapping(slabs),
      isBundled: true,
      isGlobalDefault: Boolean(definition.isGlobalDefault),
    };

    let template;
    if (existing) {
      Object.assign(existing, {
        ...payload,
        isGlobalDefault: definition.isGlobalDefault
          ? true
          : existing.isGlobalDefault,
      });
      template = await existing.save();
    } else {
      template = await Template.create(payload);
    }

    if (definition.isGlobalDefault) {
      await templatesRepository.clearOtherGlobalDefaults(template.id);
      template.isGlobalDefault = true;
      await template.save();
    }

    templateByCode.set(definition.code, template);
    logger.info(`[seed] Bundled Form 5 template ensured: ${definition.code}`);
  }

  for (const definition of BUNDLED_FORM5_TEMPLATES) {
    const template = templateByCode.get(definition.code);
    if (!template || !definition.locationNames?.length) continue;

    for (const locationName of definition.locationNames) {
      const nameKey = locationNameKey(locationName);
      let location = await Location.findOne({ nameKey });
      if (!location) {
        location = await Location.create({
          name: locationName,
          nameKey,
          defaultTemplate: template.id,
        });
        logger.info(`[seed] Location created with default template: ${locationName}`);
        continue;
      }
      const currentDefault = location.defaultTemplate
        ? String(location.defaultTemplate)
        : '';
      if (currentDefault !== String(template.id)) {
        location.defaultTemplate = template.id;
        await location.save();
        logger.info(
          `[seed] Location default template set: ${locationName} → ${definition.code}`,
        );
      }
    }
  }

  logger.info(
    `[seed] Form 5 bundled templates ensured: ${BUNDLED_FORM5_TEMPLATES.length}`,
  );
};
