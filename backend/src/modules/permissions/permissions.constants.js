export const PERMISSIONS_CODES = Object.freeze({
  PERMISSION_NOT_FOUND: 'PERMISSION_NOT_FOUND',
  PERMISSION_NAME_IN_USE: 'PERMISSION_NAME_IN_USE',
});

export const PERMISSIONS_MESSAGES = Object.freeze({
  CREATED: 'Permission created successfully.',
  UPDATED: 'Permission updated successfully.',
  DELETED: 'Permission deleted successfully.',
  FETCHED: 'Permissions fetched successfully.',
});

/**
 * Canonical permission names for the modules that exist so far.
 * Used by route guards (single source of truth for permission strings)
 * and by the seeder.
 */
export const PERMISSION_NAMES = Object.freeze({
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_EDIT: 'roles.edit',
  ROLES_DELETE: 'roles.delete',
  PERMISSIONS_VIEW: 'permissions.view',
  PERMISSIONS_CREATE: 'permissions.create',
  PERMISSIONS_EDIT: 'permissions.edit',
  PERMISSIONS_DELETE: 'permissions.delete',
  ACTIVITY_VIEW: 'activity.view',
  // Permanent erasure (GDPR "right to be forgotten") — separate from
  // users.delete, which only soft-deletes
  USERS_ERASE: 'users.erase',
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_DELETE: 'clients.delete',
  UPLOADS_VIEW: 'uploads.view',
  UPLOADS_CREATE: 'uploads.create',
  UPLOADS_PURGE: 'uploads.purge',
  EMPLOYEES_VIEW: 'employees.view',
  FILINGS_VIEW: 'filings.view',
  FILINGS_CREATE: 'filings.create',
  FILINGS_EDIT: 'filings.edit',
  FILINGS_GENERATE: 'filings.generate',
  FILINGS_SEND: 'filings.send',
  TEMPLATES_VIEW: 'templates.view',
  TEMPLATES_CREATE: 'templates.create',
  TEMPLATES_EDIT: 'templates.edit',
  TEMPLATES_DELETE: 'templates.delete',
});

/** Default permission set inserted by the seeder. */
export const DEFAULT_PERMISSIONS = Object.freeze([
  { name: PERMISSION_NAMES.USERS_VIEW, module: 'users', description: 'View and list users' },
  { name: PERMISSION_NAMES.USERS_CREATE, module: 'users', description: 'Create users' },
  { name: PERMISSION_NAMES.USERS_EDIT, module: 'users', description: 'Edit users and change their status' },
  { name: PERMISSION_NAMES.USERS_DELETE, module: 'users', description: 'Delete users' },
  { name: PERMISSION_NAMES.ROLES_VIEW, module: 'roles', description: 'View and list roles' },
  { name: PERMISSION_NAMES.ROLES_CREATE, module: 'roles', description: 'Create roles' },
  { name: PERMISSION_NAMES.ROLES_EDIT, module: 'roles', description: 'Edit roles, their permissions and user assignments' },
  { name: PERMISSION_NAMES.ROLES_DELETE, module: 'roles', description: 'Delete roles' },
  { name: PERMISSION_NAMES.PERMISSIONS_VIEW, module: 'permissions', description: 'View and list permissions' },
  { name: PERMISSION_NAMES.PERMISSIONS_CREATE, module: 'permissions', description: 'Create permissions' },
  { name: PERMISSION_NAMES.PERMISSIONS_EDIT, module: 'permissions', description: 'Edit permissions' },
  { name: PERMISSION_NAMES.PERMISSIONS_DELETE, module: 'permissions', description: 'Delete permissions' },
  { name: PERMISSION_NAMES.ACTIVITY_VIEW, module: 'activity', description: 'View the append-only activity/audit log' },
  { name: PERMISSION_NAMES.USERS_ERASE, module: 'users', description: 'Permanently erase a user and their data (irreversible)' },
  { name: PERMISSION_NAMES.CLIENTS_VIEW, module: 'clients', description: 'View and list employer clients' },
  { name: PERMISSION_NAMES.CLIENTS_CREATE, module: 'clients', description: 'Create employer clients' },
  { name: PERMISSION_NAMES.CLIENTS_EDIT, module: 'clients', description: 'Edit employer clients' },
  { name: PERMISSION_NAMES.CLIENTS_DELETE, module: 'clients', description: 'Delete employer clients' },
  { name: PERMISSION_NAMES.UPLOADS_VIEW, module: 'uploads', description: 'View MasterSheet and salary uploads' },
  { name: PERMISSION_NAMES.UPLOADS_CREATE, module: 'uploads', description: 'Upload MasterSheet and salary workbooks' },
  { name: PERMISSION_NAMES.UPLOADS_PURGE, module: 'uploads', description: 'Clear imported master or salary data' },
  { name: PERMISSION_NAMES.EMPLOYEES_VIEW, module: 'employees', description: 'View employee month snapshots' },
  { name: PERMISSION_NAMES.FILINGS_VIEW, module: 'filings', description: 'View Form 5 filings' },
  { name: PERMISSION_NAMES.FILINGS_CREATE, module: 'filings', description: 'Create Form 5 filings' },
  { name: PERMISSION_NAMES.FILINGS_EDIT, module: 'filings', description: 'Edit Form 5 filings' },
  { name: PERMISSION_NAMES.FILINGS_GENERATE, module: 'filings', description: 'Generate filled Form 5 files' },
  { name: PERMISSION_NAMES.FILINGS_SEND, module: 'filings', description: 'Send generated Form 5 on WhatsApp' },
  { name: PERMISSION_NAMES.TEMPLATES_VIEW, module: 'templates', description: 'View Form 5 templates and mappings' },
  { name: PERMISSION_NAMES.TEMPLATES_CREATE, module: 'templates', description: 'Upload Form 5 templates' },
  { name: PERMISSION_NAMES.TEMPLATES_EDIT, module: 'templates', description: 'Edit template mappings and assignments' },
  { name: PERMISSION_NAMES.TEMPLATES_DELETE, module: 'templates', description: 'Delete Form 5 templates' },
]);
