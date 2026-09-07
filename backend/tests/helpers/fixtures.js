import Permission from '../../src/modules/permissions/permission.model.js';
import { DEFAULT_PERMISSIONS } from '../../src/modules/permissions/permissions.constants.js';
import PtSlab from '../../src/modules/ptSlabs/ptSlab.model.js';
import {
  GUJARAT_DEFAULT_EFFECTIVE_FROM,
  GUJARAT_DEFAULT_SLABS,
} from '../../src/modules/ptSlabs/ptSlabs.constants.js';
import Role from '../../src/modules/roles/role.model.js';
import { ROLE_NAMES } from '../../src/modules/roles/roles.constants.js';
import { hashPassword } from '../../src/utils/password.js';
import User from '../../src/modules/users/user.model.js';

/** Seed the full permission + role set Super Admin needs for HTTP tests. */
export const seedRbac = async () => {
  const permissions = await Permission.insertMany(
    DEFAULT_PERMISSIONS.map((permission) => ({
      name: permission.name,
      module: permission.module,
      description: permission.description,
    })),
  );
  const permissionIds = permissions.map((permission) => permission._id);

  const [superAdmin, userRole] = await Role.create([
    {
      name: ROLE_NAMES.SUPER_ADMIN,
      description: 'Full access',
      isSystemRole: true,
      permissions: permissionIds,
    },
    {
      name: ROLE_NAMES.USER,
      description: 'Default user',
      isSystemRole: true,
      permissions: [],
    },
  ]);

  return { permissions, superAdmin, userRole };
};

export const seedGujaratSlabs = async () => {
  await PtSlab.insertMany(
    GUJARAT_DEFAULT_SLABS.map((slab) => ({
      salaryFrom: slab.salaryFrom,
      salaryTo: slab.salaryTo ?? null,
      rate: slab.rate,
      label: slab.label,
      sortOrder: slab.sortOrder,
      effectiveFrom: GUJARAT_DEFAULT_EFFECTIVE_FROM,
    })),
  );
};

export const createVerifiedUser = async ({
  name = 'Test User',
  email = 'user@example.com',
  password = 'Password1',
  role = null,
  isActive = true,
} = {}) => {
  const user = await User.create({
    name,
    email,
    password: await hashPassword(password),
    role,
    isActive,
    isEmailVerified: true,
  });
  return user;
};

/** Login via HTTP and return the access token + cookies for subsequent calls. */
export const loginAs = async (app, request, { email, password }) => {
  const response = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
  });

  if (response.status !== 200) {
    throw new Error(`loginAs failed: ${response.status} ${response.text}`);
  }

  return {
    accessToken: response.body.data.accessToken,
    csrfToken: response.body.data.csrfToken,
    cookies: response.headers['set-cookie'],
    user: response.body.data.user,
  };
};

export const authHeader = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
});
