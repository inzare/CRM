import { ArrowUpRight, CalendarClock, ClipboardCheck, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '../auth/auth-context';

const shortcuts: Array<{ title: string; description: string; icon: LucideIcon }> = [
  { title: 'Pipeline', description: 'Review active opportunities', icon: ArrowUpRight },
  { title: 'My tasks', description: 'Focus on today and overdue', icon: ClipboardCheck },
  { title: 'Renewals', description: 'Protect upcoming revenue', icon: CalendarClock },
  { title: 'Follow-up', description: 'Reconnect with quiet accounts', icon: Sparkles },
];

export function HomePage(): React.JSX.Element {
  const { user } = useAuth();
  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">
            Your workspace
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink-950 sm:text-4xl">
            Good to see you, {user?.name.split(' ')[0]}.
          </h1>
          <p className="mt-2 text-ink-700">
            Stay close to the conversations and decisions that move revenue forward.
          </p>
        </div>
        <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-700 shadow-sm">
          Role: {user?.role}
        </p>
      </header>
      <section aria-label="Workspace shortcuts" className="metric-grid grid gap-4">
        {shortcuts.map(({ title, description, icon: Icon }) => (
          <article key={title} className="surface rounded-2xl p-5">
            <span className="mb-8 grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
              <Icon className="size-5" />
            </span>
            <h2 className="font-extrabold text-ink-950">{title}</h2>
            <p className="mt-1 text-sm text-ink-700">{description}</p>
          </article>
        ))}
      </section>
      <section className="surface mt-6 rounded-2xl p-6 sm:p-8">
        <p className="text-sm font-bold text-teal-600">ConsultFlow is ready</p>
        <h2 className="mt-2 text-2xl font-black text-ink-950">
          Start with a customer relationship or your next task.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-700">
          Your data and actions are scoped to your role. Commercial metrics and live follow-up
          widgets appear here as their API modules are enabled.
        </p>
      </section>
    </div>
  );
}
