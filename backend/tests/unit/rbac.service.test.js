const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const { seedRbac, createVerifiedUser } = await import('../helpers/fixtures.js');
const usersService = await import('../../src/modules/users/users.service.js');
const rolesService = await import('../../src/modules/roles/roles.service.js');
const permissionsService = await import(
  '../../src/modules/permissions/permissions.service.js'
);
const User = (await import('../../src/modules/users/user.model.js')).default;

describe('users / roles / permissions CRUD services', () => {
  let rbac;
  let actor;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    rbac = await seedRbac();
    actor = await createVerifiedUser({
      email: 'admin@example.com',
      password: 'Password1',
      role: rbac.superAdmin.id,
    });
  });

  test('users CRUD: create, list, update, soft-delete', async () => {
    const created = await usersService.createUser(
      {
        name: 'Managed User',
        email: 'managed@example.com',
        password: 'Password1',
        role: rbac.userRole.id,
        isActive: true,
      },
      actor.id,
    );

    expect(created.email).toBe('managed@example.com');

    const listed = await usersService.listUsers({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(listed.users.some((user) => user.email === 'managed@example.com')).toBe(
      true,
    );

    const updated = await usersService.updateUser(
      created.id,
      { name: 'Renamed User' },
      actor.id,
    );
    expect(updated.name).toBe('Renamed User');

    await usersService.deleteUser(created.id, actor.id);

    await expect(usersService.getUser(created.id)).rejects.toMatchObject({
      statusCode: 404,
    });

    const raw = await User.findById(created.id).setOptions({
      withDeleted: true,
    });
    expect(raw.isDeleted).toBe(true);
  });

  test('roles CRUD: create, update, soft-delete', async () => {
    const created = await rolesService.createRole(
      { name: 'Editor', description: 'Can edit' },
      actor.id,
    );
    expect(created.name).toBe('Editor');

    const updated = await rolesService.updateRole(
      created.id,
      { description: 'Updated' },
      actor.id,
    );
    expect(updated.description).toBe('Updated');

    await rolesService.deleteRole(created.id, actor.id);
    await expect(rolesService.getRole(created.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('permissions CRUD: create, update, soft-delete', async () => {
    const created = await permissionsService.createPermission(
      {
        name: 'reports.view',
        module: 'reports',
        description: 'View reports',
      },
      actor.id,
    );
    expect(created.name).toBe('reports.view');

    const updated = await permissionsService.updatePermission(
      created.id,
      { description: 'Updated desc' },
      actor.id,
    );
    expect(updated.description).toBe('Updated desc');

    await permissionsService.deletePermission(created.id, actor.id);
    const listed = await permissionsService.listPermissions({});
    expect(
      listed.some((permission) => permission.name === 'reports.view'),
    ).toBe(false);
  });
});
