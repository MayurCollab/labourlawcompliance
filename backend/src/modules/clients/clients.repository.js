import Client from './client.model.js';

const LOCATION_POPULATE = { path: 'location', select: 'name' };

export const createClient = (data) => Client.create(data);

export const findClients = (filter, { sort, skip, limit }) =>
  Client.find(filter).sort(sort).skip(skip).limit(limit).populate(LOCATION_POPULATE);

export const countClients = (filter = {}) => Client.countDocuments(filter);

export const findClientById = (id) =>
  Client.findById(id).populate(LOCATION_POPULATE);

export const findClientByCode = (clientCode) => Client.findOne({ clientCode });

export const findAllCompact = () =>
  Client.find()
    .select('clientCode companyName phyCode fundCode location')
    .populate(LOCATION_POPULATE)
    .sort({ companyName: 1, clientCode: 1 });

/** Full client docs for MasterSheet / Client-Master import upserts. */
export const findAllForImport = () => Client.find();

export const saveClient = (client, session = null) =>
  client.save(session ? { session } : {});

/** Clear address + RC fields from Client-Master imports (clients stay). */
export const clearAddressFields = (actorId) =>
  Client.updateMany(
    {
      isDeleted: false,
      $or: [
        { address: { $nin: [null, ''] } },
        { rcNumber: { $nin: [null, ''] } },
      ],
    },
    {
      $set: {
        address: null,
        rcNumber: null,
        updatedBy: actorId,
      },
    },
  );

export const findClientForTemplateResolve = (id) =>
  Client.findById(id)
    .select('clientCode companyName location template')
    .populate({
      path: 'location',
      select: 'name defaultTemplate',
      populate: { path: 'defaultTemplate', select: 'name code kind' },
    })
    .populate({ path: 'template', select: 'name code kind mapping placeholders' });

export const findClientIdsByLocation = (locationId) =>
  Client.find({ location: locationId }).distinct('_id');

export const findClientsByTemplate = (templateId) =>
  Client.find({ template: templateId }).select('clientCode companyName');

export const countClientsByTemplate = (templateId) =>
  Client.countDocuments({ template: templateId });

export const clearClientTemplateRefs = (templateId) =>
  Client.updateMany({ template: templateId }, { $set: { template: null } });

export const softDeleteAllClients = (actorId) =>
  Client.updateMany(
    { isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: actorId,
      },
    },
  );
