import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CalendarClock, Download, Target, TrendingUp, Trophy } from 'lucide-react';

import { useAuth } from '../auth/auth-context';
import { apiRequest, downloadApiFile } from '../lib/api';

interface TaskSummary {
  id: string;
  subject: string;
  dueAt: string;
  company: { name: string } | null;
  opportunity: { name: string } | null;
}
interface Dashboard {
  sales: null | {
    pipeline: Array<{
      stageId: string;
      name: string;
      type: string;
      count: number;
      value: string;
      weighted: string;
    }>;
    weightedForecast: string;
    wonRevenue: string;
    leadConversionRate: number;
    winRate: number;
    wonCount: number;
    lostCount: number;
    salesByOffering: Array<{ sku: string; value: string }>;
    currency: string;
  };
  today: TaskSummary[];
  overdue: TaskSummary[];
  noRecentActivity: Array<{ id: string; name: string; owner: { name: string } }>;
  renewals: Array<{
    id: string;
    number: string;
    amount: string;
    currency: string;
    renewalDate: string;
    opportunity: { company: { name: string } };
  }>;
}

export function HomePage(): React.JSX.Element {
  const { user } = useAuth();
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/dashboard'),
  });
  if (dashboard.isLoading) return <p className="p-8 text-sm">Loading your workspace?</p>;
  if (!dashboard.data)
    return (
      <p role="alert" className="p-8 font-bold text-red-700">
        Dashboard data could not be loaded.
      </p>
    );
  const data = dashboard.data;
  const maxPipeline = Math.max(
    1,
    ...(data.sales?.pipeline.map((stage) => Number(stage.value)) ?? [1]),
  );
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
        <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">
          Role: {user?.role}
        </p>
      </header>
      {data.sales && (
        <>
          <section aria-label="Sales metrics" className="metric-grid grid gap-4">
            <Metric
              icon={TrendingUp}
              label="Weighted forecast"
              value={money(data.sales.weightedForecast, data.sales.currency)}
              detail="Probability-adjusted pipeline"
            />
            <Metric
              icon={Trophy}
              label="Won revenue"
              value={money(data.sales.wonRevenue, data.sales.currency)}
              detail={`${data.sales.wonCount} won opportunities`}
            />
            <Metric
              icon={Target}
              label="Lead conversion"
              value={percent(data.sales.leadConversionRate)}
              detail="Qualified demand converted"
            />
            <Metric
              icon={AlertCircle}
              label="Win rate"
              value={percent(data.sales.winRate)}
              detail={`${data.sales.wonCount} won / ${data.sales.lostCount} lost`}
            />
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <article className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                    Pipeline
                  </p>
                  <h2 className="mt-1 text-xl font-black">Value by stage</h2>
                </div>
                <ExportButton kind="opportunities" />
              </div>
              <div className="mt-6 grid gap-4">
                {data.sales.pipeline.map((stage) => (
                  <div
                    key={stage.stageId}
                    className="grid grid-cols-[110px_1fr_auto] items-center gap-3"
                  >
                    <span className="truncate text-sm font-bold">{stage.name}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-cloud-100">
                      <div
                        className={`h-full rounded-full ${stage.type === 'WON' ? 'bg-emerald-500' : stage.type === 'LOST' ? 'bg-slate-400' : 'bg-teal-500'}`}
                        style={{
                          width: `${Math.max(2, (Number(stage.value) / maxPipeline) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-right text-xs font-bold">
                      {money(stage.value, data.sales?.currency ?? 'USD')}
                    </span>
                  </div>
                ))}
              </div>
            </article>
            <article className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                    Offering mix
                  </p>
                  <h2 className="mt-1 text-xl font-black">Accepted sales</h2>
                </div>
                <ExportButton kind="offering-sales" />
              </div>
              <ul className="mt-5 grid gap-3">
                {data.sales.salesByOffering.map((item) => (
                  <li key={item.sku} className="flex justify-between rounded-xl bg-cloud-50 p-3">
                    <span className="font-bold">{item.sku}</span>
                    <span>{money(item.value, data.sales?.currency ?? 'USD')}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      )}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <TaskWidget title="My tasks today" tasks={data.today} />
        <TaskWidget title="Overdue" tasks={data.overdue} danger />
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-600">Reconnect</p>
          <h2 className="mt-1 text-lg font-black">No activity recently</h2>
          <ul className="mt-4 grid gap-2">
            {data.noRecentActivity.map((company) => (
              <li key={company.id} className="rounded-xl bg-cloud-50 p-3">
                <span className="font-bold">{company.name}</span>
                <span className="block text-xs text-ink-700">Owner {company.owner.name}</span>
              </li>
            ))}
          </ul>
          {data.noRecentActivity.length === 0 && <Empty />}
        </article>
      </section>
      {data.renewals.length > 0 && (
        <section className="surface mt-6 rounded-2xl p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                Customer value
              </p>
              <h2 className="mt-1 text-xl font-black">Upcoming renewals</h2>
            </div>
            <ExportButton kind="renewals" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.renewals.map((item) => (
              <article key={item.id} className="rounded-xl bg-cloud-50 p-4">
                <CalendarClock className="size-5 text-teal-600" />
                <h3 className="mt-3 font-black">{item.opportunity.company.name}</h3>
                <p className="text-sm">{money(item.amount, item.currency)}</p>
                <p className="mt-1 text-xs text-ink-700">
                  Renews {new Date(item.renewalDate).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  detail: string;
}): React.JSX.Element {
  return (
    <article className="surface rounded-2xl p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
        <Icon className="size-5" />
      </span>
      <p className="mt-6 text-sm font-bold text-ink-700">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-ink-700">{detail}</p>
    </article>
  );
}
function TaskWidget({
  title,
  tasks,
  danger,
}: {
  title: string;
  tasks: TaskSummary[];
  danger?: boolean;
}): React.JSX.Element {
  return (
    <article className="surface rounded-2xl p-5">
      <p
        className={`text-xs font-bold uppercase tracking-wider ${danger ? 'text-red-600' : 'text-teal-600'}`}
      >
        Follow-up
      </p>
      <h2 className="mt-1 text-lg font-black">{title}</h2>
      <ul className="mt-4 grid gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-xl bg-cloud-50 p-3">
            <span className="font-bold">{task.subject}</span>
            <span className="block text-xs text-ink-700">
              {task.company?.name ?? task.opportunity?.name ?? 'CRM record'} ?{' '}
              {new Date(task.dueAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && <Empty />}
    </article>
  );
}
function ExportButton({ kind }: { kind: string }): React.JSX.Element {
  return (
    <button
      onClick={() => void downloadApiFile(`/reports/${kind}.csv`, `consultflow-${kind}.csv`)}
      className="no-print rounded-lg p-2 text-ink-700 hover:bg-cloud-100"
      aria-label={`Export ${kind} CSV`}
    >
      <Download className="size-4" />
    </button>
  );
}
function Empty(): React.JSX.Element {
  return <p className="mt-4 text-sm text-ink-700">Nothing needs attention here.</p>;
}
function money(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}
function percent(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  );
}
