import Filing from './filing.model.js';

const CLIENT_POPULATE = {
  path: 'client',
  select: 'clientCode companyName location phyCode template includeEmployeesOnForm5 address',
  populate: [
    {
      path: 'location',
      select: 'name defaultTemplate',
      populate: { path: 'defaultTemplate', select: 'name code' },
    },
    { path: 'template', select: 'name code' },
  ],
};

export const createFiling = (data) => Filing.create(data);

export const findFilings = (filter, { sort, skip, limit }) =>
  Filing.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(CLIENT_POPULATE);

export const countFilings = (filter = {}) => Filing.countDocuments(filter);

export const findFilingById = (id) =>
  Filing.findById(id).populate(CLIENT_POPULATE);

export const findFilingByClientAndPeriod = (clientId, period) =>
  Filing.findOne({ client: clientId, period });

/** Preload filings for one or more periods during MasterSheet import. */
export const findFilingsByPeriods = (periods) => {
  const list = [...new Set((periods || []).filter(Boolean))];
  if (!list.length) return Promise.resolve([]);
  return Filing.find({ period: { $in: list } });
};

export const findFilingIds = (filter, { sort = { clientCode: 1 }, limit = 200 } = {}) =>
  Filing.find(filter).sort(sort).limit(limit).select('clientCode');

export const saveFiling = (filing, session = null) =>
  filing.save(session ? { session } : {});

export const softDeleteAllFilings = (actorId) =>
  Filing.updateMany(
    { isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: actorId,
      },
    },
  );
