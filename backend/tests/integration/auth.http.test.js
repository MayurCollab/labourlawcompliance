import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../src/email/emailService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const { seedRbac, createVerifiedUser } = await import('../helpers/fixtures.js');
const app = (await import('../../src/app.js')).default;

describe('auth HTTP (supertest)', () => {
  let rbac;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    rbac = await seedRbac();
  });

  test('POST /api/v1/auth/register → 201', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'HTTP User',
        email: 'http@example.com',
        password: 'Password1',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test('POST /api/v1/auth/login → 200 with tokens', async () => {
    await createVerifiedUser({
      email: 'http-login@example.com',
      password: 'Password1',
      role: rbac.userRole.id,
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'http-login@example.com',
      password: 'Password1',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.headers['set-cookie']).toBeDefined();
  });

  test('GET /api/v1/users requires auth', async () => {
    const response = await request(app).get('/api/v1/users');
    expect(response.status).toBe(401);
  });
});
