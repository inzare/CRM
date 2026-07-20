import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoginPage } from './login-page';

describe('LoginPage', () => {
  it('exposes labeled credential controls and sign-in action', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email address/i })).toHaveAttribute(
      'type',
      'email',
    );
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });
});
