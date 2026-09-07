/** Shapes permission documents for API responses. */

export const toPermissionDto = (permission) => ({
  id: permission.id,
  name: permission.name,
  module: permission.module,
  description: permission.description,
  createdAt: permission.createdAt,
  updatedAt: permission.updatedAt,
});

export const toPermissionListDto = (permissions) =>
  permissions.map(toPermissionDto);

/** Groups permissions by module: { users: [...], roles: [...] } */
export const toGroupedPermissionsDto = (permissions) =>
  permissions.reduce((acc, permission) => {
    const key = permission.module;
    if (!acc[key]) acc[key] = [];
    acc[key].push(toPermissionDto(permission));
    return acc;
  }, {});
