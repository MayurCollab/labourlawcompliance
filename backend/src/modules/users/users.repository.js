import User from './user.model.js';

export const createUser = (data) => User.create(data);

export const findUsers = (filter, { sort, skip, limit }) =>
  User.find(filter).sort(sort).skip(skip).limit(limit).populate('role', 'name');

export const countUsers = (filter = {}) => User.countDocuments(filter);

export const findUserById = (id) =>
  User.findById(id).populate({
    path: 'role',
    select: 'name permissions',
    populate: { path: 'permissions', select: 'name' },
  });

export const findUserByEmail = (email) => User.findOne({ email });

export const saveUser = (user) => user.save();

/**
 * Erasure paths must be able to see soft-deleted rows: a user who was
 * soft-deleted last month can still ask to be erased.
 */
export const findUserByIdIncludingDeleted = (id) =>
  User.findById(id).setOptions({ withDeleted: true });

export const findUserByIdWithPasswordIncludingDeleted = (id) =>
  User.findById(id).select('+password').setOptions({ withDeleted: true });

/** Irreversible. Only called from the erasure flow. */
export const hardDeleteUser = (id, session = null) =>
  User.deleteOne({ _id: id }, { withDeleted: true, session });

/** Bulk-assign a role to users (used by the Roles module). */
export const assignRoleToUsers = (userIds, roleId, actorId, session = null) =>
  User.updateMany(
    { _id: { $in: userIds } },
    { $set: { role: roleId, updatedBy: actorId } },
    { session },
  );
