import Location from './location.model.js';

export const createLocation = (data) => Location.create(data);

export const findAllLocations = () =>
  Location.find()
    .populate({ path: 'defaultTemplate', select: 'name code' })
    .sort({ name: 1 });

export const findLocationById = (id) =>
  Location.findById(id).populate({ path: 'defaultTemplate', select: 'name code' });

export const findLocationByNameKey = (nameKey) => Location.findOne({ nameKey });

export const saveLocation = (location, session = null) =>
  location.save(session ? { session } : {});

export const findLocationsByTemplate = (templateId) =>
  Location.find({ defaultTemplate: templateId }).select('name');

export const clearLocationTemplateRefs = (templateId) =>
  Location.updateMany(
    { defaultTemplate: templateId },
    { $set: { defaultTemplate: null } },
  );
