/**
 * Database seeder — idempotent, safe to run multiple times.
 *
 * Run from the repo root:   npm run seed -w backend
 * Or from backend/:          npm run seed
 *
 * Seeds:
 *   1. The default permission set (upserted by name — existing docs are updated)
 *   2. System roles: "Super Admin" (always synced to ALL permissions) and
 *      "User" (default role for self-registered users, no permissions)
 *   3. A default admin user (from SEED_ADMIN_* env vars) — created only if
 *      missing; an existing user's password is never overwritten.
 *   4. Gujarat PT slab defaults (insert-only — existing rates are not overwritten)
 *   5. Settings singleton (empty signatory)
 *   6. Bundled Form 5 HTML templates + location defaults
 */
import config from '../../config/index.js';
import { connectDB, disconnectDB } from '../../config/db.js';
import Permission from '../../modules/permissions/permission.model.js';
import { DEFAULT_PERMISSIONS } from '../../modules/permissions/permissions.constants.js';
import PtSlab from '../../modules/ptSlabs/ptSlab.model.js';
import {
  GUJARAT_DEFAULT_EFFECTIVE_FROM,
  GUJARAT_DEFAULT_SLABS,
} from '../../modules/ptSlabs/ptSlabs.constants.js';
import Role from '../../modules/roles/role.model.js';
import { ROLE_NAMES } from '../../modules/roles/roles.constants.js';
import Settings from '../../modules/settings/settings.model.js';
import { SETTINGS_SINGLETON_KEY } from '../../modules/settings/settings.constants.js';
import User from '../../modules/users/user.model.js';
import logger from '../../utils/logger.js';
import { hashPassword } from '../../utils/password.js';
import { seedForm5BundledTemplates } from './seedForm5Templates.js';

const seedPermissions = async () => {
  const permissions = [];

  for (const definition of DEFAULT_PERMISSIONS) {
    const permission = await Permission.findOneAndUpdate(
      { name: definition.name },
      { $set: { module: definition.module, description: definition.description } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    permissions.push(permission);
  }

  logger.info(`[seed] Permissions ensured: ${permissions.length}`);
  return permissions;
};

const seedRoles = async (allPermissions) => {
  // Super Admin always holds every permission (kept in sync on every run)
  const superAdminRole = await Role.findOneAndUpdate(
    { name: ROLE_NAMES.SUPER_ADMIN },
    {
      $set: {
        description: 'Full access to every module and action',
        isSystemRole: true,
        permissions: allPermissions.map((p) => p._id),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Default role for self-registered users; permissions left as-is so
  // admins can customize it without the seeder resetting their changes
  const userRole = await Role.findOneAndUpdate(
    { name: ROLE_NAMES.USER },
    {
      $set: {
        description: 'Default role for self-registered users',
        isSystemRole: true,
      },
      $setOnInsert: { permissions: [] },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  logger.info(
    `[seed] Roles ensured: "${superAdminRole.name}" (${superAdminRole.permissions.length} permissions), "${userRole.name}"`,
  );
  return { superAdminRole, userRole };
};

const seedAdminUser = async (superAdminRole) => {
  const { name, email, password } = config.seedAdmin;

  const existing = await User.findOne({ email });

  if (existing) {
    // Never touch the password of an existing account; just guarantee access
    if (String(existing.role) !== String(superAdminRole._id)) {
      existing.role = superAdminRole._id;
      await existing.save();
      logger.info(`[seed] Admin user "${email}" re-linked to Super Admin role`);
    } else {
      logger.info(`[seed] Admin user "${email}" already exists — skipped`);
    }
    return;
  }

  await User.create({
    name,
    email,
    password: await hashPassword(password),
    role: superAdminRole._id,
    isActive: true,
    isEmailVerified: true,
  });

  logger.info(`[seed] Admin user created: ${email}`);
};

const seedPtSlabs = async () => {
  let inserted = 0;

  for (const definition of GUJARAT_DEFAULT_SLABS) {
    const result = await PtSlab.findOneAndUpdate(
      {
        salaryFrom: definition.salaryFrom,
        salaryTo: definition.salaryTo,
        effectiveFrom: GUJARAT_DEFAULT_EFFECTIVE_FROM,
      },
      {
        $setOnInsert: {
          ...definition,
          effectiveFrom: GUJARAT_DEFAULT_EFFECTIVE_FROM,
          effectiveTo: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      inserted += 1;
    }
  }

  logger.info(
    `[seed] PT slabs ensured: ${GUJARAT_DEFAULT_SLABS.length} Gujarat defaults (${inserted} inserted)`,
  );
};

const seedSettings = async () => {
  await Settings.findOneAndUpdate(
    { key: SETTINGS_SINGLETON_KEY },
    { $setOnInsert: { key: SETTINGS_SINGLETON_KEY, signatoryName: '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  logger.info('[seed] Settings singleton ensured');
};

const run = async () => {
  await connectDB();

  const permissions = await seedPermissions();
  const { superAdminRole } = await seedRoles(permissions);
  await seedAdminUser(superAdminRole);
  await seedPtSlabs();
  await seedSettings();
  await seedForm5BundledTemplates();

  await disconnectDB();
  logger.info('[seed] Done.');
};

run().catch(async (err) => {
  logger.error(`[seed] Failed: ${err.stack || err.message}`);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
