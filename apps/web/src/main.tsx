import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/auth-context';
import { ProtectedRoute } from './auth/protected-route';
import { AppShell } from './components/app-shell';
import { ForgotPasswordPage, SetPasswordPage } from './pages/credential-pages';
import { HomePage } from './pages/home-page';
import { LoginPage } from './pages/login-page';
import { ProfilePage } from './pages/profile-page';
import { UsersPage } from './pages/users-page';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<SetPasswordPage />} />
            <Route path="/accept-invitation" element={<SetPasswordPage invitation />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
