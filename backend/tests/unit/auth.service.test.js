import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/email/emailService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const { seedRbac, createVerifiedUser } = await import('../helpers/fixtures.js');
const authService = await import('../../src/modules/auth/auth.service.js');
const authRepository = await import(
  '../../src/modules/auth/auth.repository.js'
);
const { generateRandomToken, sha256 } = await import(
  '../../src/utils/crypto.js'
);

describe('auth.service', () => {
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

  test('register creates an inactive, unverified user', async () => {
    const { user } = await authService.register({
      name: 'New User',
      email: 'new@example.com',
      password: 'Password1',
    });

    expect(user.email).toBe('new@example.com');
    expect(user.isEmailVerified).toBe(false);
    expect(user.isActive).toBe(false);
    expect(user.role).toBeTruthy();
  });

  test('login returns tokens for a verified active user', async () => {
    await createVerifiedUser({
      email: 'login@example.com',
      password: 'Password1',
      role: rbac.userRole.id,
    });

    const result = await authService.login({
      email: 'login@example.com',
      password: 'Password1',
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe('login@example.com');
  });

  test('refreshTokens rotates a valid refresh token', async () => {
    await createVerifiedUser({
      email: 'refresh@example.com',
      password: 'Password1',
      role: rbac.userRole.id,
    });

    const login = await authService.login({
      email: 'refresh@example.com',
      password: 'Password1',
    });

    const refreshed = await authService.refreshTokens(login.refreshToken);

    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);

    await expect(
      authService.refreshTokens(login.refreshToken),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('resetPassword accepts a valid reset token', async () => {
    const user = await createVerifiedUser({
      email: 'reset@example.com',
      password: 'Password1',
      role: rbac.userRole.id,
    });

    const rawToken = generateRandomToken();
    user.passwordResetToken = sha256(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await authRepository.saveUser(user);

    await authService.resetPassword({
      token: rawToken,
      password: 'NewPassword1',
    });

    const result = await authService.login({
      email: 'reset@example.com',
      password: 'NewPassword1',
    });
    expect(result.accessToken).toBeTruthy();
  });
});
