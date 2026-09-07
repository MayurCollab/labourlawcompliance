import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from '@/pages/auth/LoginPage';
import { renderWithProviders } from '@/test/test-utils';

const mutate = vi.fn();

vi.mock('@/hooks/useAuthMutations', () => ({
  useLoginMutation: () => ({
    mutate,
    isPending: false,
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it('submits email and password on happy path', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'Admin@1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'Admin@1234',
        rememberMe: true,
      });
    });
  });
});
