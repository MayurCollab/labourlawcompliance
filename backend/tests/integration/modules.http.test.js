import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../src/email/emailService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const {
  seedRbac,
  createVerifiedUser,
  loginAs,
  authHeader,
} = await import('../helpers/fixtures.js');
const app = (await import('../../src/app.js')).default;

describe('health HTTP', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  test('GET /api/v1/health/live → 200 alive', async () => {
    const response = await request(app).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('alive');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('GET /api/v1/health/ready → 200 when mongo is up', async () => {
    const response = await request(app).get('/api/v1/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.checks.database.status).toBe('up');
  });

  test('GET /api/v1/health → 200 (legacy)', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
  });
});

describe('users / roles / permissions HTTP', () => {
  let rbac;
  let adminSession;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    rbac = await seedRbac();
    await createVerifiedUser({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'Password1',
      role: rbac.superAdmin.id,
    });
    adminSession = await loginAs(app, request, {
      email: 'admin@example.com',
      password: 'Password1',
    });
  });

  test('GET /api/v1/users → 200 for admin', async () => {
    const response = await request(app)
      .get('/api/v1/users')
      .set(authHeader(adminSession.accessToken));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.users)).toBe(true);
  });

  test('POST /api/v1/users → 201 creates user', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminSession.accessToken))
      .send({
        name: 'Created User',
        email: 'created@example.com',
        password: 'Password1',
        role: rbac.userRole.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe('created@example.com');
  });

  test('GET /api/v1/roles → 200', async () => {
    const response = await request(app)
      .get('/api/v1/roles')
      .set(authHeader(adminSession.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.data.roles.length).toBeGreaterThanOrEqual(2);
  });

  test('PATCH /api/v1/roles/:id/permissions → 200', async () => {
    const viewPerm = rbac.permissions.find((p) => p.name === 'users.view');

    const response = await request(app)
      .patch(`/api/v1/roles/${rbac.userRole.id}/permissions`)
      .set(authHeader(adminSession.accessToken))
      .send({ permissions: [String(viewPerm._id)] });

    expect(response.status).toBe(200);
    expect(response.body.data.role.permissions.some((p) => p.name === 'users.view')).toBe(
      true,
    );
  });

  test('GET /api/v1/permissions → 200', async () => {
    const response = await request(app)
      .get('/api/v1/permissions')
      .set(authHeader(adminSession.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.data.permissions.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/activity → 200', async () => {
    const response = await request(app)
      .get('/api/v1/activity')
      .set(authHeader(adminSession.accessToken));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.entries)).toBe(true);
  });

  test('GET /api/v1/users/me/export → 200 JSON attachment', async () => {
    const response = await request(app)
      .get('/api/v1/users/me/export')
      .set(authHeader(adminSession.accessToken));

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/attachment/);
    expect(response.body.profile.email).toBe('admin@example.com');
  });

  test('DELETE /api/v1/users/:id soft-deletes; erase hard-deletes', async () => {
    const created = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminSession.accessToken))
      .send({
        name: 'Temp',
        email: 'temp-erase@example.com',
        password: 'Password1',
      });

    const userId = created.body.data.user.id;

    const soft = await request(app)
      .delete(`/api/v1/users/${userId}`)
      .set(authHeader(adminSession.accessToken));
    expect(soft.status).toBe(200);

    // Soft-deleted user is gone from normal get
    const missing = await request(app)
      .get(`/api/v1/users/${userId}`)
      .set(authHeader(adminSession.accessToken));
    expect(missing.status).toBe(404);

    // Create another and erase
    const created2 = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminSession.accessToken))
      .send({
        name: 'Temp2',
        email: 'temp-erase-2@example.com',
        password: 'Password1',
      });

    const erase = await request(app)
      .delete(`/api/v1/users/${created2.body.data.user.id}/erase`)
      .set(authHeader(adminSession.accessToken))
      .send({});

    expect(erase.status).toBe(200);
    expect(erase.body.data.userId).toBe(created2.body.data.user.id);
  });
});
