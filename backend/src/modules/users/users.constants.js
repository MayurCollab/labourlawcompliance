export const USERS_CODES = Object.freeze({
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  INVALID_ROLE: 'INVALID_ROLE',
  SELF_ACTION_FORBIDDEN: 'SELF_ACTION_FORBIDDEN',
  FILE_REQUIRED: 'FILE_REQUIRED',
});

export const USERS_MESSAGES = Object.freeze({
  CREATED: 'User created successfully.',
  UPDATED: 'User updated successfully.',
  DELETED: 'User deleted successfully.',
  FETCHED: 'Users fetched successfully.',
  STATUS_UPDATED: 'User status updated successfully.',
  PROFILE_FETCHED: 'Profile fetched successfully.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  AVATAR_UPDATED: 'Profile picture updated successfully.',
  ERASED: 'Account and associated data permanently erased.',
});

/** Whitelist of sortable fields for the admin list endpoint. */
export const USER_SORTABLE_FIELDS = Object.freeze([
  'name',
  'email',
  'createdAt',
  'updatedAt',
]);

/** Folder (under /uploads) where avatars are stored. */
export const AVATAR_FOLDER = 'avatars';
