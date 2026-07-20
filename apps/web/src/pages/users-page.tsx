import type { PaginatedResponse, Role } from '@consultflow/contracts';
import { roles } from '@consultflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserCheck, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { ApiError, apiRequest } from '../lib/api';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function UsersPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'SALES' as Role });
  const users = useQuery({
    queryKey: ['users', search],
    queryFn: () =>
      apiRequest<PaginatedResponse<UserRow>>(`/users?search=${encodeURIComponent(search)}`),
  });
  const create = useMutation({
    mutationFn: () => apiRequest<UserRow>('/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setShowCreate(false);
      setForm({ name: '', email: '', role: 'SALES' });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: Pick<UserRow, 'id' | 'isActive'>) =>
      apiRequest<UserRow>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  const error = create.error instanceof ApiError ? create.error.message : '';

  return (
    <div>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-black text-ink-950">Users</h1>
          <p className="mt-2 text-sm text-ink-700">
            Invite teammates, assign roles, and control access.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" />
          Invite user
        </button>
      </header>
      {showCreate && (
        <section className="surface mb-6 rounded-2xl p-5" aria-labelledby="create-user-title">
          <div className="flex items-center justify-between">
            <h2 id="create-user-title" className="text-lg font-extrabold text-ink-950">
              Invite a teammate
            </h2>
            <button onClick={() => setShowCreate(false)} className="text-sm font-bold text-ink-700">
              Cancel
            </button>
          </div>
          <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="h-11 rounded-xl border border-slate-300 px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="h-11 rounded-xl border border-slate-300 px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Role
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                className="h-11 rounded-xl border border-slate-300 px-3"
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700 md:col-span-3">
                {error}
              </p>
            )}
            <div className="md:col-span-3">
              <button
                disabled={create.isPending}
                className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white"
              >
                {create.isPending ? 'Sending?' : 'Send invitation'}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-sm">
            <span className="sr-only">Search users</span>
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm"
            />
          </label>
        </div>
        {users.isLoading ? (
          <p className="p-8 text-sm text-ink-700">Loading users?</p>
        ) : users.isError ? (
          <p role="alert" className="p-8 text-sm font-semibold text-red-700">
            Users could not be loaded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-cloud-50 text-xs uppercase tracking-wider text-ink-700">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last login</th>
                  <th className="px-5 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data?.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4">
                      <span className="block font-bold text-ink-950">{user.name}</span>
                      <span className="text-xs text-ink-700">{user.email}</span>
                    </td>
                    <td className="px-5 py-4 font-semibold">{user.role}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-700">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate(user)}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-bold text-ink-700 hover:bg-cloud-100"
                      >
                        {user.isActive ? (
                          <UserX className="size-4" />
                        ) : (
                          <UserCheck className="size-4" />
                        )}
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
