import mongoose from 'mongoose';

import Filing from './filing.model.js';

const CLIENT_POPULATE = {
  path: 'client',
  select:
    'clientCode companyName location phyCode template includeEmployeesOnForm5 address signatoryName contactNumber recipientName',
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

export const findFilingsByIds = (ids) =>
  Filing.find({ _id: { $in: ids } }).populate(CLIENT_POPULATE);

export const findFilingByClientAndPeriod =(clientId, period) =>
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

export const bulkWriteFilings = (ops, options = {}) =>
  Filing.bulkWrite(ops, { ordered: false, ...options });

/**
 * Each client's most recent filing (by period) with just its generateStatus —
 * used by the Clients page's Pending/Generated/Failed filter and status badge,
 * which reflect the client's latest Form 5 rather than any one period.
 * Scoped to `clientIds` when given, otherwise covers every client with at
 * least one filing. `aggregate` bypasses the soft-delete query middleware, so
 * `isDeleted` is matched explicitly here (see auditPlugin.js).
 */
export const findLatestFilingStatusByClientIds = (clientIds) => {
  const match = { isDeleted: { $ne: true }, client: { $ne: null } };
  if (clientIds) {
    const ids = [...new Set((clientIds || []).filter(Boolean).map(String))];
    if (!ids.length) return Promise.resolve([]);
    match.client = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  return Filing.aggregate([
    { $match: match },
    { $sort: { period: -1 } },
    {
      $group: {
        _id: '$client',
        generateStatus: { $first: '$generateStatus' },
        period: { $first: '$period' },
        periodLabel: { $first: '$periodLabel' },
      },
    },
  ]);
};

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
