import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { LoginPage } from './login-page';

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe('LoginPage', () => {
  it('exposes labeled credential controls and sign-in action', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email address/i })).toHaveAttribute(
      'type',
      'email',
    );
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });
});
