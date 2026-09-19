import WhatsAppTemplate from './whatsappTemplate.model.js';

export const createWhatsAppTemplate = (data) => WhatsAppTemplate.create(data);

export const findWhatsAppTemplates = (filter, { sort, skip, limit }) =>
  WhatsAppTemplate.find(filter).sort(sort).skip(skip).limit(limit);

export const countWhatsAppTemplates = (filter = {}) =>
  WhatsAppTemplate.countDocuments(filter);

export const findWhatsAppTemplateById = (id) => WhatsAppTemplate.findById(id);

export const findSeededWhatsAppTemplate = () =>
  WhatsAppTemplate.findOne({ isSeeded: true }, null, { withDeleted: true });

export const saveWhatsAppTemplate = (template, session = null) =>
  template.save(session ? { session } : {});
