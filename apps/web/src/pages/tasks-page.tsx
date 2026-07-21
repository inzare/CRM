import type { PaginatedResponse } from '@consultflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../auth/auth-context';
import { ApiError, apiRequest } from '../lib/api';

interface Task {
  id: string;
  subject: string;
  description: string | null;
  priority: string;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  dueAt: string;
  assignee: { id: string; name: string };
  company: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
}
interface Assignee {
  id: string;
  name: string;
  role: string;
}
interface Company {
  id: string;
  name: string;
}

export function TasksPage(): React.JSX.Element {
  const { user } = useAuth();
  const client = useQueryClient();
  const [view, setView] = useState<'all' | 'today' | 'overdue'>('all');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM',
    dueAt: '',
    assigneeId: '',
    companyId: '',
  });
  const tasks = useQuery({
    queryKey: ['tasks', view, search],
    queryFn: () =>
      apiRequest<PaginatedResponse<Task>>(
        `/tasks?${view === 'all' ? '' : `view=${view}&`}search=${encodeURIComponent(search)}`,
      ),
  });
  const assignees = useQuery({
    queryKey: ['assignees'],
    queryFn: () => apiRequest<Assignee[]>('/assignees'),
  });
  const companies = useQuery({
    queryKey: ['companies-options'],
    queryFn: () => apiRequest<PaginatedResponse<Company>>('/companies?pageSize=100'),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['tasks'] });
  const create = useMutation({
    mutationFn: () =>
      apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...form, dueAt: new Date(form.dueAt).toISOString() }),
      }),
    onSuccess: async () => {
      setShow(false);
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (task: Task) =>
      apiRequest<Task>(`/tasks/${task.id}/${task.status === 'OPEN' ? 'complete' : 'reopen'}`, {
        method: 'POST',
      }),
    onSuccess: refresh,
  });
  return (
    <div>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">Follow-up</p>
          <h1 className="mt-2 text-3xl font-black">Tasks</h1>
          <p className="mt-2 text-sm text-ink-700">
            Keep commitments visible and close the loop on every relationship.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" />
          New task
        </button>
      </header>
      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex rounded-xl bg-cloud-100 p-1" role="group" aria-label="Task view">
            {(['all', 'today', 'overdue'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${view === item ? 'bg-white shadow-sm' : 'text-ink-700'}`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search tasks</span>
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
              className="h-10 rounded-xl border border-slate-300 pl-10 pr-3 text-sm"
            />
          </label>
        </div>
        <ul className="divide-y divide-slate-100">
          {tasks.data?.data.map((task) => {
            const overdue = task.status === 'OPEN' && new Date(task.dueAt) < new Date();
            return (
              <li key={task.id} className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto]">
                <button
                  onClick={() => toggle.mutate(task)}
                  aria-label={`${task.status === 'OPEN' ? 'Complete' : 'Reopen'} ${task.subject}`}
                  className={`grid size-10 place-items-center rounded-xl ${task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'border-2 border-slate-300 text-slate-400'}`}
                >
                  {task.status === 'COMPLETED' ? (
                    <Check className="size-5" />
                  ) : (
                    <Clock3 className="size-5" />
                  )}
                </button>
                <div>
                  <h2
                    className={`font-extrabold ${task.status === 'COMPLETED' ? 'text-slate-500 line-through' : 'text-ink-950'}`}
                  >
                    {task.subject}
                  </h2>
                  <p className="mt-1 text-sm text-ink-700">
                    {task.company?.name ?? task.opportunity?.name ?? 'CRM record'} ?{' '}
                    {task.assignee.name}
                  </p>
                  {task.description && (
                    <p className="mt-2 text-sm text-ink-700">{task.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${overdue ? 'bg-red-50 text-red-700' : 'bg-cloud-100 text-ink-700'}`}
                  >
                    {overdue ? 'Overdue' : task.priority}
                  </span>
                  <p className="mt-2 text-xs text-ink-700">
                    {new Date(task.dueAt).toLocaleString()}
                  </p>
                  {task.status === 'COMPLETED' && (
                    <RotateCcw className="ml-auto mt-2 size-4 text-slate-400" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {tasks.data?.data.length === 0 && (
          <p className="p-10 text-center text-sm text-ink-700">No tasks in this view.</p>
        )}
      </section>
      {show && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/55 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
            className="surface w-full max-w-2xl rounded-2xl p-6"
          >
            <div className="flex justify-between">
              <h2 id="task-dialog-title" className="text-xl font-black">
                Create task
              </h2>
              <button onClick={() => setShow(false)} aria-label="Close dialog">
                <X />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              className="mt-6 grid gap-4 sm:grid-cols-2"
            >
              <Field
                label="Subject"
                required
                value={form.subject}
                onChange={(subject) => setForm({ ...form, subject })}
              />
              <Field
                label="Due"
                type="datetime-local"
                required
                value={form.dueAt}
                onChange={(dueAt) => setForm({ ...form, dueAt })}
              />
              <Select
                label="Assignee"
                value={form.assigneeId}
                options={
                  assignees.data
                    ?.filter((item) => user?.role !== 'CONSULTANT' || item.id === user.id)
                    .map((item) => ({
                      value: item.id,
                      label: `${item.name} ? ${item.role}`,
                    })) ?? []
                }
                onChange={(assigneeId) => setForm({ ...form, assigneeId })}
              />
              <Select
                label="Company"
                value={form.companyId}
                options={
                  companies.data?.data.map((item) => ({ value: item.id, label: item.name })) ?? []
                }
                onChange={(companyId) => setForm({ ...form, companyId })}
              />
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="min-h-24 rounded-xl border border-slate-300 p-3"
                />
              </label>
              <button
                disabled={create.isPending}
                className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white sm:col-span-2"
              >
                {create.isPending ? 'Saving?' : 'Create task'}
              </button>
              {create.error && (
                <p role="alert" className="text-sm font-bold text-red-700 sm:col-span-2">
                  {create.error instanceof ApiError
                    ? create.error.message
                    : 'Task could not be created.'}
                </p>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  onChange,
  ...props
}: { label: string; onChange: (value: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange'
>): React.JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input
        {...props}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-slate-300 px-3"
      />
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-slate-300 px-3"
      >
        <option value="">Choose?</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
