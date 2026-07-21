import type { PaginatedResponse } from '@consultflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, GripVertical, Plus, Search, Sparkles, X } from 'lucide-react';
import { useState, type DragEvent, type FormEvent } from 'react';

import { ApiError, apiRequest } from '../lib/api';

interface Lead {
  id: string;
  companyName: string | null;
  contactFirstName: string;
  contactLastName: string;
  email: string | null;
  source: string;
  interest: string;
  budget: string | null;
  currency: string;
  status: 'NEW' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED';
  opportunity: { id: string; name: string } | null;
}
interface Opportunity {
  id: string;
  name: string;
  stageId: string;
  expectedValue: string;
  currency: string;
  probability: number;
  closeDate: string;
  company: { id: string; name: string };
  owner: { id: string; name: string };
}
interface Stage {
  id: string;
  key: string;
  displayName: string;
  type: 'OPEN' | 'WON' | 'LOST';
  defaultProbability: number;
  transitionsFrom: Array<{ toStageId: string }>;
  opportunities: Opportunity[];
  count: number;
  value: string;
}

export function LeadsPage(): React.JSX.Element {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactFirstName: '',
    contactLastName: '',
    email: '',
    source: 'Referral',
    interest: '',
    budget: '',
    currency: 'USD',
  });
  const leads = useQuery({
    queryKey: ['leads', search],
    queryFn: () =>
      apiRequest<PaginatedResponse<Lead>>(`/leads?search=${encodeURIComponent(search)}`),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['leads'] });
  const create = useMutation({
    mutationFn: () => apiRequest<Lead>('/leads', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setShowCreate(false);
      await refresh();
    },
  });
  const qualify = useMutation({
    mutationFn: (lead: Lead) =>
      apiRequest<Lead>(`/leads/${lead.id}/qualify`, {
        method: 'POST',
        body: JSON.stringify({ qualificationNotes: window.prompt('Qualification notes') ?? '' }),
      }),
    onSuccess: refresh,
  });
  const convert = useMutation({
    mutationFn: (lead: Lead) => {
      const expectedValue = window.prompt('Expected opportunity value', lead.budget ?? '0');
      const closeDate = window.prompt(
        'Expected close date (YYYY-MM-DD)',
        new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      );
      return apiRequest(`/leads/${lead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          opportunityName: `${lead.companyName ?? `${lead.contactFirstName} ${lead.contactLastName}`} opportunity`,
          expectedValue,
          closeDate,
        }),
      });
    },
    onSuccess: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  return (
    <div>
      <PageHeader
        eyebrow="Demand"
        title="Leads"
        description="Qualify real buying signals and convert them without losing history."
        action={() => setShowCreate(true)}
        actionLabel="New lead"
      />
      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 p-4">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search leads, companies, or interests"
          />
        </div>
        {leads.isLoading ? (
          <p className="p-8">Loading leads?</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-cloud-50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-5 py-3">Interest</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.data?.data.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-5 py-4">
                      <span className="block font-extrabold text-ink-950">
                        {lead.companyName ?? `${lead.contactFirstName} ${lead.contactLastName}`}
                      </span>
                      <span className="text-xs text-ink-700">
                        {lead.contactFirstName} {lead.contactLastName} ? {lead.source}
                      </span>
                    </td>
                    <td className="max-w-sm px-5 py-4 text-ink-700">{lead.interest}</td>
                    <td className="px-5 py-4 font-bold">
                      {lead.budget ? money(lead.budget, lead.currency) : 'Not set'}
                    </td>
                    <td className="px-5 py-4">
                      <Status value={lead.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {lead.status === 'NEW' ? (
                        <Action onClick={() => qualify.mutate(lead)} label="Qualify" />
                      ) : lead.status === 'QUALIFIED' ? (
                        <Action onClick={() => convert.mutate(lead)} label="Convert" />
                      ) : lead.opportunity ? (
                        <span className="text-xs font-bold text-teal-600">
                          {lead.opportunity.name}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {showCreate && (
        <Dialog title="Create lead" close={() => setShowCreate(false)}>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Company"
              required
              value={form.companyName}
              onChange={(companyName) => setForm({ ...form, companyName })}
            />
            <Field
              label="Source"
              required
              value={form.source}
              onChange={(source) => setForm({ ...form, source })}
            />
            <Field
              label="First name"
              required
              value={form.contactFirstName}
              onChange={(contactFirstName) => setForm({ ...form, contactFirstName })}
            />
            <Field
              label="Last name"
              required
              value={form.contactLastName}
              onChange={(contactLastName) => setForm({ ...form, contactLastName })}
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(email) => setForm({ ...form, email })}
            />
            <Field
              label="Budget"
              type="number"
              min="0"
              value={form.budget}
              onChange={(budget) => setForm({ ...form, budget })}
            />
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Interest
              <textarea
                required
                value={form.interest}
                onChange={(event) => setForm({ ...form, interest: event.target.value })}
                className="min-h-28 rounded-xl border border-slate-300 p-3"
              />
            </label>
            <button
              disabled={create.isPending}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white sm:col-span-2"
            >
              {create.isPending ? 'Saving?' : 'Create lead'}
            </button>
            {create.error && <ErrorMessage error={create.error} />}
          </form>
        </Dialog>
      )}
    </div>
  );
}

export function PipelinePage(): React.JSX.Element {
  const client = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const board = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => apiRequest<Stage[]>('/pipeline'),
  });
  const transition = useMutation({
    mutationFn: ({ opportunity, target }: { opportunity: Opportunity; target: Stage }) => {
      const lost = target.type === 'LOST';
      return apiRequest<Opportunity>(`/opportunities/${opportunity.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          expectedStageId: opportunity.stageId,
          toStageId: target.id,
          reason: lost ? 'Lost during sales process' : `Moved to ${target.displayName}`,
          ...(lost
            ? {
                lossReason: window.prompt('Loss reason') ?? '',
                competitor: window.prompt('Competitor') ?? '',
              }
            : {}),
        }),
      });
    },
    onMutate: async ({ opportunity, target }) => {
      await client.cancelQueries({ queryKey: ['pipeline'] });
      const previous = client.getQueryData<Stage[]>(['pipeline']);
      client.setQueryData<Stage[]>(['pipeline'], (current) =>
        current?.map((stage) => {
          if (stage.id === opportunity.stageId)
            return {
              ...stage,
              opportunities: stage.opportunities.filter((item) => item.id !== opportunity.id),
              count: Math.max(0, stage.count - 1),
              value: String(Number(stage.value) - Number(opportunity.expectedValue)),
            };
          if (stage.id === target.id)
            return {
              ...stage,
              opportunities: [
                ...stage.opportunities,
                {
                  ...opportunity,
                  stageId: target.id,
                  probability: target.defaultProbability,
                },
              ],
              count: stage.count + 1,
              value: String(Number(stage.value) + Number(opportunity.expectedValue)),
            };
          return stage;
        }),
      );
      setAnnouncement(`Moving ${opportunity.name} to ${target.displayName}.`);
      return { previous };
    },
    onSuccess: (opportunity) => {
      setAnnouncement(`${opportunity.name} moved successfully.`);
    },
    onError: (error, _variables, context) => {
      if (context?.previous) client.setQueryData(['pipeline'], context.previous);
      setAnnouncement(
        `${error instanceof ApiError ? error.message : 'The opportunity could not be moved.'} The board was restored.`,
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['pipeline'] }),
  });
  const move = (opportunity: Opportunity, targetId: string) => {
    const target = board.data?.find((stage) => stage.id === targetId);
    if (target && target.id !== opportunity.stageId) transition.mutate({ opportunity, target });
  };
  const drop = (event: DragEvent, stage: Stage) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('application/consultflow-opportunity');
    const opportunity = board.data
      ?.flatMap((item) => item.opportunities)
      .find((item) => item.id === payload);
    if (opportunity) move(opportunity, stage.id);
  };
  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Opportunity pipeline"
        description="Move qualified work through a controlled, auditable sales process."
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {board.isLoading ? (
        <p>Loading pipeline?</p>
      ) : board.isError ? (
        <p role="alert" className="text-red-700">
          The pipeline could not be loaded.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-5" aria-label="Opportunity pipeline">
          {board.data?.map((stage) => (
            <section
              key={stage.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, stage)}
              className="w-[310px] shrink-0 rounded-2xl bg-cloud-100 p-3"
              aria-labelledby={`stage-${stage.id}`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <div>
                  <h2 id={`stage-${stage.id}`} className="font-extrabold text-ink-950">
                    {stage.displayName}
                  </h2>
                  <p className="text-xs text-ink-700">
                    {stage.count} deals ? {money(stage.value, 'USD')}
                  </p>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-bold">
                  {stage.count}
                </span>
              </header>
              <div className="grid gap-3">
                {stage.opportunities.map((opportunity) => (
                  <article
                    key={opportunity.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'application/consultflow-opportunity',
                        opportunity.id,
                      );
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    className="surface rounded-xl p-4"
                  >
                    <div className="flex gap-2">
                      <GripVertical
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-slate-400"
                      />
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-ink-950">{opportunity.name}</h3>
                        <p className="truncate text-xs text-ink-700">{opportunity.company.name}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="font-black text-ink-950">
                          {money(opportunity.expectedValue, opportunity.currency)}
                        </p>
                        <p className="text-xs text-ink-700">
                          {opportunity.probability}% ?{' '}
                          {new Date(opportunity.closeDate).toLocaleDateString()}
                        </p>
                      </div>
                      <label className="text-xs font-bold">
                        <span className="sr-only">Move {opportunity.name}</span>
                        <select
                          value={stage.id}
                          onChange={(event) => move(opportunity, event.target.value)}
                          className="max-w-28 rounded-lg border border-slate-300 bg-white p-2"
                        >
                          <option value={stage.id}>Move?</option>
                          {board.data
                            .filter((target) =>
                              stage.transitionsFrom?.some(
                                (transition) => transition.toStageId === target.id,
                              ),
                            )
                            .map((target) => (
                              <option key={target.id} value={target.id}>
                                {target.displayName}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}): React.JSX.Element {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black text-ink-950">{title}</h1>
        <p className="mt-2 text-sm text-ink-700">{description}</p>
      </div>
      {action && (
        <button
          onClick={action}
          className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" />
          {actionLabel}
        </button>
      )}
    </header>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): React.JSX.Element {
  return (
    <label className="relative block max-w-md">
      <span className="sr-only">{placeholder}</span>
      <Search className="absolute left-3 top-3 size-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm"
      />
    </label>
  );
}
function Status({ value }: { value: string }): React.JSX.Element {
  return (
    <span className="rounded-full bg-cloud-100 px-2.5 py-1 text-xs font-bold text-ink-700">
      {value.replace('_', ' ')}
    </span>
  );
}
function Action({ onClick, label }: { onClick: () => void; label: string }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-teal-600 hover:bg-teal-50"
    >
      {label}
      {label === 'Qualify' ? (
        <Sparkles className="size-3.5" />
      ) : (
        <ArrowRight className="size-3.5" />
      )}
    </button>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/55 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-dialog-title"
        className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="sales-dialog-title" className="text-xl font-black">
            {title}
          </h2>
          <button
            onClick={close}
            aria-label="Close dialog"
            className="rounded-lg p-2 hover:bg-cloud-100"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </section>
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
function ErrorMessage({ error }: { error: Error }): React.JSX.Element {
  return (
    <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">
      {error instanceof ApiError ? error.message : 'The request could not be completed.'}
    </p>
  );
}
function money(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}
