/** Seeded system role names (single source of truth). */
export const ROLE_NAMES = Object.freeze({
  SUPER_ADMIN: 'Super Admin',
  USER: 'User',
});

export const ROLES_CODES = Object.freeze({
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  ROLE_NAME_IN_USE: 'ROLE_NAME_IN_USE',
  SYSTEM_ROLE_PROTECTED: 'SYSTEM_ROLE_PROTECTED',
  ROLE_IN_USE: 'ROLE_IN_USE',
  INVALID_PERMISSIONS: 'INVALID_PERMISSIONS',
});

export const ROLES_MESSAGES = Object.freeze({
  CREATED: 'Role created successfully.',
  UPDATED: 'Role updated successfully.',
  DELETED: 'Role deleted successfully.',
  FETCHED: 'Roles fetched successfully.',
  PERMISSIONS_UPDATED: 'Role permissions updated successfully.',
  USERS_ASSIGNED: 'Users assigned to role successfully.',
});
