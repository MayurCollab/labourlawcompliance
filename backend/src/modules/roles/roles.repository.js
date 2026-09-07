import Role from './role.model.js';

export const createRole = (data) => Role.create(data);

export const findAllRoles = () =>
  Role.find().populate('permissions', 'name module description').sort({ name: 1 });

export const findRoleById = (id) => Role.findById(id);

export const findRoleByIdWithPermissions = (id) =>
  Role.findById(id).populate('permissions', 'name module description');

export const findRoleByName = (name) => Role.findOne({ name });

/** `session` is set when the caller runs inside a transaction. */
export const saveRole = (role, session = null) =>
  role.save(session ? { session } : {});
