import ActivityLog from './activityLog.model.js';

/**
 * The only write path into the activity log. There is intentionally no
 * update or delete function in this repository.
 */
export const insertActivity = (doc, options = {}) =>
  options.session
    ? ActivityLog.create([doc], { session: options.session })
    : ActivityLog.create(doc);

export const findActivity = (filter, { sort, skip, limit }) =>
  ActivityLog.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('actorId', 'name email')
    .lean();

export const countActivity = (filter) => ActivityLog.countDocuments(filter);
