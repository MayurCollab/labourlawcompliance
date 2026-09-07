/** Central route path constants — use these instead of string literals. */
export const PATHS = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  /** Authenticated account area */
  changePassword: '/account/change-password',
  /** Domain modules */
  clients: '/clients',
  uploads: '/uploads',
  employees: '/employees',
  form5: '/form-5',
  templates: '/templates',
  ptSlabs: '/pt-slabs',
  /** Admin modules */
  users: '/users',
  roles: '/roles',
  permissions: '/permissions',
  forbidden: '/403',
  /** Internal component gallery — not linked in the real nav. */
  devComponents: '/dev/components',
  notFound: '*',
} as const;

export type AppPath = (typeof PATHS)[keyof typeof PATHS];
