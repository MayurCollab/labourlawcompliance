import { toRoleRefDto } from '../roles/roles.dto.js';

/** Shapes user documents for API responses (never exposes secrets). */

const extractPermissionNames = (role) => {
  if (!role || typeof role !== 'object' || !Array.isArray(role.permissions)) {
    return [];
  }

  return role.permissions
    .map((permission) =>
      permission && typeof permission === 'object' ? permission.name : null,
    )
    .filter(Boolean);
};

export const toUserDto = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: toRoleRefDto(user.role),
  permissions: extractPermissionNames(user.role),
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const toUserListDto = (users) => users.map(toUserDto);
