import Template from './template.model.js';

export const createTemplate = (data) => Template.create(data);

export const findTemplates = (filter, { sort, skip, limit }) =>
  Template.find(filter).sort(sort).skip(skip).limit(limit);

export const countTemplates = (filter = {}) => Template.countDocuments(filter);

export const findTemplateById = (id) => Template.findById(id);

export const findTemplateByIdWithPath = (id) =>
  Template.findById(id).select('+storedPath');

export const findTemplateByCode = (code) => Template.findOne({ code });

export const findGlobalDefault = () =>
  Template.findOne({ isGlobalDefault: true });

export const findBundledTemplates = () =>
  Template.find({ isBundled: true }).sort({ name: 1 });

export const clearOtherGlobalDefaults = (excludeId) =>
  Template.updateMany(
    { isGlobalDefault: true, _id: { $ne: excludeId } },
    { $set: { isGlobalDefault: false } },
  );

export const saveTemplate = (template, session = null) =>
  template.save(session ? { session } : {});
