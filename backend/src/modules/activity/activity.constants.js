export const ACTIVITY_MESSAGES = Object.freeze({
  FETCHED: 'Activity log fetched successfully.',
});

/**
 * Canonical action names. Keep them `<module>.<verb>` so the log can be
 * filtered by module with a prefix query.
 */
export const ACTIVITY_ACTIONS = Object.freeze({
  USER_CREATE: 'users.create',
  USER_UPDATE: 'users.update',
  USER_STATUS_CHANGE: 'users.status.change',
  USER_SOFT_DELETE: 'users.soft_delete',
  USER_HARD_DELETE: 'users.hard_delete',
  USER_DATA_EXPORT: 'users.data_export',
  USER_AVATAR_UPDATE: 'users.avatar.update',

  ROLE_CREATE: 'roles.create',
  ROLE_UPDATE: 'roles.update',
  ROLE_SOFT_DELETE: 'roles.soft_delete',
  ROLE_PERMISSIONS_UPDATE: 'roles.permissions.update',
  ROLE_USERS_ASSIGN: 'roles.users.assign',

  PERMISSION_CREATE: 'permissions.create',
  PERMISSION_UPDATE: 'permissions.update',
  PERMISSION_SOFT_DELETE: 'permissions.soft_delete',

  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGOUT_ALL: 'auth.logout_all',
  AUTH_PASSWORD_CHANGE: 'auth.password.change',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_TOKEN_REUSE_DETECTED: 'auth.token.reuse_detected',

  CLIENT_CREATE: 'clients.create',
  CLIENT_UPDATE: 'clients.update',
  CLIENT_SOFT_DELETE: 'clients.soft_delete',
  CLIENT_EXPORT: 'clients.export',

  LOCATION_CREATE: 'locations.create',
  LOCATION_UPDATE: 'locations.update',
  LOCATION_SOFT_DELETE: 'locations.soft_delete',

  PT_SLAB_CREATE: 'ptSlabs.create',
  PT_SLAB_UPDATE: 'ptSlabs.update',
  PT_SLAB_SOFT_DELETE: 'ptSlabs.soft_delete',

  SETTINGS_UPDATE: 'settings.update',

  UPLOAD_IMPORT: 'uploads.import',
  UPLOAD_PURGE_MASTER: 'uploads.purge_master',
  UPLOAD_PURGE_SALARY: 'uploads.purge_salary',
  UPLOAD_PURGE_CLIENT_MASTER: 'uploads.purge_client_master',

  FILING_COMPUTE: 'filings.compute',
  FILING_GENERATE: 'filings.generate',
  FILING_BULK_GENERATE: 'filings.bulk_generate',
  FILING_OVERRIDES_UPDATE: 'filings.overrides_update',

  TEMPLATE_CREATE: 'templates.create',
  TEMPLATE_UPDATE: 'templates.update',
  TEMPLATE_ASSIGN: 'templates.assign',
  TEMPLATE_SOFT_DELETE: 'templates.soft_delete',
});

export const ENTITY_TYPES = Object.freeze({
  USER: 'User',
  ROLE: 'Role',
  PERMISSION: 'Permission',
  SESSION: 'Session',
  CLIENT: 'Client',
  LOCATION: 'Location',
  PT_SLAB: 'PtSlab',
  SETTINGS: 'Settings',
  UPLOAD: 'Upload',
  FILING: 'Filing',
  EMPLOYEE: 'Employee',
  TEMPLATE: 'Template',
});
