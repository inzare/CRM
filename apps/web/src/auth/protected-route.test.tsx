import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from './protected-route';

const authState = vi.hoisted(() => ({
  loading: false,
  user: null as null | { id: string; email: string; name: string; role: 'ADMIN' | 'CONSULTANT' },
}));

vi.mock('./auth-context', () => ({ useAuth: () => authState }));

function renderRoute(): void {
  render(
    <MemoryRouter initialEntries={['/users']}>
      <Routes>
        <Route path="/login" element={<h1>Login destination</h1>} />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <h1>User administration</h1>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.user = null;
  });

  it('redirects an anonymous visitor to sign in', () => {
    renderRoute();
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
  });

  it('shows an accessible denial without rendering protected content', () => {
    authState.user = {
      id: 'consultant-id',
      email: 'consultant@consultflow.local',
      name: 'Diego Navarro',
      role: 'CONSULTANT',
    };
    renderRoute();
    expect(screen.getByRole('heading', { name: /not available for your role/i })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'User administration' })).not.toBeInTheDocument();
  });

  it('renders protected content for an allowed role', () => {
    authState.user = {
      id: 'admin-id',
      email: 'admin@consultflow.local',
      name: 'Ana Torres',
      role: 'ADMIN',
    };
    renderRoute();
    expect(screen.getByRole('heading', { name: 'User administration' })).toBeVisible();
  });
});
