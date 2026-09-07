import logger from '../../utils/logger.js';
import { getRequestContext } from '../../utils/requestContext.js';
import * as activityRepository from './activity.repository.js';

/**
 * Appends one record to the append-only activity log.
 *
 * Never throws: an audit-write failure must not roll back or fail the
 * business operation the user asked for. Failures are logged at error level
 * so they surface in monitoring instead of disappearing.
 *
 * Pass `session` when the caller is inside a transaction so the audit record
 * commits or aborts with the write it describes.
 */
export const recordActivity = async ({
  action,
  entityType,
  entityId = null,
  changes = null,
  outcome = 'success',
  actorId,
  actorEmail,
  session = null,
}) => {
  try {
    const ctx = getRequestContext() || {};

    const doc = {
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      actorId: actorId ?? ctx.userId ?? null,
      actorEmail: actorEmail ?? ctx.userEmail ?? null,
      requestId: ctx.requestId ?? null,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      changes,
      outcome,
    };

    await activityRepository.insertActivity(doc, { session });
  } catch (err) {
    logger.error(`[activity] Failed to record "${action}": ${err.message}`);
  }
};

/**
 * Read-only listing. There is no update or delete counterpart by design.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const actionFilter = (action) => {
  if (!action) return null;
  if (action.includes('.') && !action.endsWith('.')) return action;
  return { $regex: `^${escapeRegex(action)}` };
};

export const listActivity = async (query) => {
  const { page, limit, action, entityType, entityId, actorId } = query;

  const filter = {};
  const actionMatch = actionFilter(action);
  if (actionMatch) filter.action = actionMatch;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (actorId) filter.actorId = actorId;

  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    activityRepository.findActivity(filter, {
      sort: { createdAt: -1 },
      skip,
      limit,
    }),
    activityRepository.countActivity(filter),
  ]);

  return {
    entries: entries.map((entry) => ({
      id: String(entry._id),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.actorId
        ? {
            id: String(entry.actorId._id ?? entry.actorId),
            name: entry.actorId.name ?? null,
            email: entry.actorId.email ?? entry.actorEmail ?? null,
          }
        : { id: null, name: null, email: entry.actorEmail },
      requestId: entry.requestId,
      ip: entry.ip,
      changes: entry.changes,
      outcome: entry.outcome,
      createdAt: entry.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};
