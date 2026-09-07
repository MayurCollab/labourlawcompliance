import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegisterPage } from '@/pages/auth/RegisterPage';
import { renderWithProviders } from '@/test/test-utils';

const mutate = vi.fn();

vi.mock('@/hooks/useAuthMutations', () => ({
  useRegisterMutation: () => ({
    mutate,
    isPending: false,
    isSuccess: false,
  }),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  it('submits registration values on happy path', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(screen.getByLabelText('Name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });

    const payload = mutate.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      name: 'New User',
      email: 'new@example.com',
      password: 'Password1',
    });
  });
});
