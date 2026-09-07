import { toPermissionDto } from '../permissions/permissions.dto.js';

/** Shapes role documents for API responses. */

const isPopulated = (value) =>
  value && typeof value === 'object' && value.name !== undefined;

export const toRoleDto = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystemRole: role.isSystemRole,
  permissions: (role.permissions || []).map((permission) =>
    isPopulated(permission) ? toPermissionDto(permission) : String(permission),
  ),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

export const toRoleListDto = (roles) => roles.map(toRoleDto);

/** Compact shape for embedding in other DTOs (e.g. a user's role). */
export const toRoleRefDto = (role) => {
  if (!role) return null;
  if (!isPopulated(role)) return { id: String(role), name: null };
  return { id: role.id, name: role.name };
};
