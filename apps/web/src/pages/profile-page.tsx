import { useState, type FormEvent } from 'react';

import { useAuth, type SessionUser } from '../auth/auth-context';
import { ApiError, apiRequest } from '../lib/api';

export function ProfilePage(): React.JSX.Element {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const updated = await apiRequest<SessionUser>('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      updateUser(updated);
      setMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Profile could not be updated.');
    }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiRequest<void>('/me/password', { method: 'POST', body: JSON.stringify(passwords) });
      setMessage('Password changed. Sign in again with your new password.');
      await logout();
      window.location.assign('/login');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Password could not be changed.');
    }
  };

  return (
    <div>
      <header className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">Account</p>
        <h1 className="mt-2 text-3xl font-black text-ink-950">Your profile</h1>
        <p className="mt-2 text-sm text-ink-700">Manage your display name and credential.</p>
      </header>
      {message && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={(event) => void saveProfile(event)} className="surface rounded-2xl p-6">
          <h2 className="text-lg font-extrabold text-ink-950">Profile</h2>
          <label className="mt-5 grid gap-2 text-sm font-semibold">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 px-3"
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            Email
            <input
              disabled
              value={user?.email ?? ''}
              className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-3 text-slate-500"
            />
          </label>
          <button className="mt-5 rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-bold text-white">
            Save profile
          </button>
        </form>
        <form onSubmit={(event) => void changePassword(event)} className="surface rounded-2xl p-6">
          <h2 className="text-lg font-extrabold text-ink-950">Change password</h2>
          <label className="mt-5 grid gap-2 text-sm font-semibold">
            Current password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) =>
                setPasswords({ ...passwords, currentPassword: event.target.value })
              }
              className="h-11 rounded-xl border border-slate-300 px-3"
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            New password
            <input
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
              className="h-11 rounded-xl border border-slate-300 px-3"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-ink-700">
            Use 12+ characters with uppercase, lowercase, a number, and a symbol.
          </p>
          <button className="mt-5 rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-bold text-white">
            Change password
          </button>
        </form>
      </div>
    </div>
  );
}
