import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/buttons/Button';

describe('Button', () => {
  it('renders children and fires click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables while loading', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
  });
});
