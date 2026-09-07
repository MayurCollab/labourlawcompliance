import Role from '../roles/role.model.js';
import Permission from './permission.model.js';

export const createPermission = (data) => Permission.create(data);

export const findAllPermissions = () =>
  Permission.find().sort({ module: 1, name: 1 });

export const findPermissionById = (id) => Permission.findById(id);

export const findPermissionByName = (name) => Permission.findOne({ name });

export const countPermissionsByIds = (ids) =>
  Permission.countDocuments({ _id: { $in: ids } });

export const savePermission = (permission, session = null) =>
  permission.save(session ? { session } : {});

/** Remove a deleted permission from every role that references it. */
export const pullPermissionFromRoles = (permissionId, session = null) =>
  Role.updateMany(
    { permissions: permissionId },
    { $pull: { permissions: permissionId } },
    { session },
  );
