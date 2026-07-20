import type { PaginatedResponse } from '@consultflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Printer, Search, Send, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../lib/api';

interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  type: string;
  pricingModel: string;
  price: string;
  currency: string;
  isActive: boolean;
  description: string | null;
}
interface Opportunity {
  id: string;
  name: string;
  currency: string;
  company: { name: string };
}
interface QuoteLine {
  id: string;
  sku: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
}
interface Quote {
  id: string;
  number: string;
  version: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  validUntil: string;
  notes: string | null;
  lines: QuoteLine[];
  opportunity: Opportunity & {
    primaryContact: { firstName: string; lastName: string; email: string | null } | null;
    owner: { name: string; email: string };
  };
}
interface Contract {
  id: string;
  number: string;
  status: string;
  amount: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  renewalDate: string | null;
  opportunity: Opportunity;
  owner: { name: string };
}

export function CatalogPage(): React.JSX.Element {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'Consulting',
    type: 'CONSULTING',
    pricingModel: 'ONE_TIME',
    price: '',
    currency: 'USD',
    description: '',
  });
  const catalog = useQuery({
    queryKey: ['catalog', search],
    queryFn: () =>
      apiRequest<PaginatedResponse<CatalogItem>>(`/catalog?search=${encodeURIComponent(search)}`),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest<CatalogItem>('/catalog', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setShow(false);
      await client.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
  return (
    <div>
      <Header
        title="Product & service catalog"
        eyebrow="Offerings"
        description="Reusable consulting, subscription, license, and implementation pricing."
        action={() => setShow(true)}
        actionLabel="New offering"
      />
      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 p-4">
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.data?.data.map((item) => (
            <article key={item.id} className="bg-white p-5">
              <div className="flex justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
                  <Package className="size-5" />
                </span>
                <Badge value={item.isActive ? 'Active' : 'Inactive'} />
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-700">
                {item.sku} ? {item.category}
              </p>
              <h2 className="mt-1 font-extrabold text-ink-950">{item.name}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-ink-700">
                {item.description ?? 'No description'}
              </p>
              <p className="mt-5 text-xl font-black text-ink-950">
                {money(item.price, item.currency)}{' '}
                <span className="text-xs font-semibold text-ink-700">
                  {item.pricingModel.replace('_', ' ')}
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>
      {show && (
        <Dialog title="New catalog offering" close={() => setShow(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field
              label="SKU"
              required
              value={form.sku}
              onChange={(sku) => setForm({ ...form, sku })}
            />
            <Field
              label="Name"
              required
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
            />
            <Field
              label="Category"
              required
              value={form.category}
              onChange={(category) => setForm({ ...form, category })}
            />
            <Field
              label="Price"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(price) => setForm({ ...form, price })}
            />
            <Select
              label="Type"
              value={form.type}
              values={['CONSULTING', 'SUBSCRIPTION', 'LICENSE', 'IMPLEMENTATION']}
              onChange={(type) => setForm({ ...form, type })}
            />
            <Select
              label="Pricing model"
              value={form.pricingModel}
              values={['ONE_TIME', 'RECURRING', 'PER_USER', 'FIXED']}
              onChange={(pricingModel) => setForm({ ...form, pricingModel })}
            />
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="min-h-24 rounded-xl border border-slate-300 p-3"
              />
            </label>
            <Save pending={create.isPending} />
            {create.error && <ErrorMessage error={create.error} />}
          </form>
        </Dialog>
      )}
    </div>
  );
}

export function QuotesPage(): React.JSX.Element {
  const client = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    opportunityId: '',
    validUntil: '',
    catalogItemId: '',
    quantity: '1',
    discountRate: '0',
    taxRate: '0',
    notes: '',
  });
  const quotes = useQuery({
    queryKey: ['quotes'],
    queryFn: () => apiRequest<PaginatedResponse<Quote>>('/quotes'),
  });
  const opportunities = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => apiRequest<PaginatedResponse<Opportunity>>('/opportunities?pageSize=100'),
  });
  const catalog = useQuery({
    queryKey: ['catalog-active'],
    queryFn: () => apiRequest<PaginatedResponse<CatalogItem>>('/catalog?active=true&pageSize=100'),
  });
  const create = useMutation({
    mutationFn: () => {
      const item = catalog.data?.data.find((candidate) => candidate.id === form.catalogItemId);
      if (!item) throw new Error('Choose an offering.');
      return apiRequest<Quote>('/quotes', {
        method: 'POST',
        body: JSON.stringify({
          opportunityId: form.opportunityId,
          validUntil: form.validUntil,
          notes: form.notes,
          lines: [
            {
              catalogItemId: item.id,
              sku: item.sku,
              description: item.name,
              quantity: form.quantity,
              unitPrice: item.price,
              discountRate: form.discountRate,
              taxRate: form.taxRate,
            },
          ],
        }),
      });
    },
    onSuccess: async () => {
      setShow(false);
      await client.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Quote['status'] }) =>
      apiRequest<Quote>(`/quotes/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['quotes'] }),
  });
  return (
    <div>
      <Header
        title="Quotes"
        eyebrow="Commercial"
        description="Versioned, auditable proposals with server-authoritative totals."
        action={() => setShow(true)}
        actionLabel="Create quote"
      />
      <section className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-cloud-50 text-xs uppercase">
              <tr>
                <th className="px-5 py-3">Quote</th>
                <th className="px-5 py-3">Opportunity</th>
                <th className="px-5 py-3">Valid until</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.data?.data.map((quote) => (
                <tr key={quote.id}>
                  <td className="px-5 py-4 font-extrabold">
                    {quote.number}
                    <span className="block text-xs font-normal text-ink-700">
                      Version {quote.version}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {quote.opportunity.name}
                    <span className="block text-xs text-ink-700">
                      {quote.opportunity.company.name}
                    </span>
                  </td>
                  <td className="px-5 py-4">{new Date(quote.validUntil).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <Badge value={quote.status} />
                  </td>
                  <td className="px-5 py-4 font-black">{money(quote.total, quote.currency)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/quotes/${quote.id}/print`}
                      className="inline-flex rounded-lg p-2 text-ink-700 hover:bg-cloud-100"
                      aria-label={`Print ${quote.number}`}
                    >
                      <Printer className="size-4" />
                    </Link>
                    {quote.status === 'DRAFT' && (
                      <button
                        onClick={() => transition.mutate({ id: quote.id, status: 'SENT' })}
                        className="inline-flex rounded-lg p-2 text-teal-600"
                        aria-label={`Send ${quote.number}`}
                      >
                        <Send className="size-4" />
                      </button>
                    )}
                    {quote.status === 'SENT' && (
                      <button
                        onClick={() => transition.mutate({ id: quote.id, status: 'ACCEPTED' })}
                        className="rounded-lg px-3 py-2 text-xs font-bold text-emerald-700"
                      >
                        Accept
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {show && (
        <Dialog title="Create quote" close={() => setShow(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Select
              label="Opportunity"
              value={form.opportunityId}
              options={
                opportunities.data?.data.map((item) => ({
                  value: item.id,
                  label: `${item.name} ? ${item.company.name}`,
                })) ?? []
              }
              onChange={(opportunityId) => setForm({ ...form, opportunityId })}
            />
            <Field
              label="Valid until"
              type="date"
              required
              value={form.validUntil}
              onChange={(validUntil) => setForm({ ...form, validUntil })}
            />
            <Select
              label="Offering"
              value={form.catalogItemId}
              options={
                catalog.data?.data.map((item) => ({
                  value: item.id,
                  label: `${item.sku} ? ${item.name}`,
                })) ?? []
              }
              onChange={(catalogItemId) => setForm({ ...form, catalogItemId })}
            />
            <Field
              label="Quantity"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.quantity}
              onChange={(quantity) => setForm({ ...form, quantity })}
            />
            <Field
              label="Discount %"
              type="number"
              min="0"
              max="100"
              value={form.discountRate}
              onChange={(discountRate) => setForm({ ...form, discountRate })}
            />
            <Field
              label="Tax %"
              type="number"
              min="0"
              max="100"
              value={form.taxRate}
              onChange={(taxRate) => setForm({ ...form, taxRate })}
            />
            <Save pending={create.isPending} />
            {create.error && <ErrorMessage error={create.error} />}
          </form>
        </Dialog>
      )}
    </div>
  );
}

export function QuotePrintPage(): React.JSX.Element {
  const { id = '' } = useParams();
  const quote = useQuery({
    queryKey: ['quote', id],
    queryFn: () => apiRequest<Quote>(`/quotes/${id}`),
  });
  if (quote.isLoading) return <p>Preparing quote?</p>;
  if (!quote.data) return <p role="alert">Quote not found.</p>;
  const data = quote.data;
  return (
    <article className="mx-auto max-w-4xl bg-white p-5 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white"
        >
          <Printer className="size-4" />
          Print / save PDF
        </button>
      </div>
      <header className="flex justify-between gap-8 border-b-4 border-ink-950 pb-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-600">ConsultFlow</p>
          <h1 className="mt-2 text-4xl font-black text-ink-950">Commercial proposal</h1>
          <p className="mt-2 text-sm text-ink-700">Software consulting & product solutions</p>
        </div>
        <dl className="text-right text-sm">
          <dt className="font-bold text-ink-700">Quote</dt>
          <dd className="font-black">{data.number}</dd>
          <dt className="mt-2 font-bold text-ink-700">Valid until</dt>
          <dd>{new Date(data.validUntil).toLocaleDateString()}</dd>
        </dl>
      </header>
      <section className="grid gap-6 py-8 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700">Prepared for</h2>
          <p className="mt-2 text-lg font-black">{data.opportunity.company.name}</p>
          {data.opportunity.primaryContact && (
            <p className="text-sm">
              {data.opportunity.primaryContact.firstName} {data.opportunity.primaryContact.lastName}
              <br />
              {data.opportunity.primaryContact.email}
            </p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700">Prepared by</h2>
          <p className="mt-2 text-lg font-black">{data.opportunity.owner.name}</p>
          <p className="text-sm">{data.opportunity.owner.email}</p>
        </div>
      </section>
      <table className="w-full text-left text-sm">
        <thead className="border-y-2 border-ink-950">
          <tr>
            <th className="py-3">Description</th>
            <th className="py-3 text-right">Qty</th>
            <th className="py-3 text-right">Unit price</th>
            <th className="py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line) => (
            <tr key={line.id} className="border-b border-slate-200">
              <td className="py-4">
                <span className="font-bold">{line.description}</span>
                <span className="block text-xs text-ink-700">{line.sku}</span>
              </td>
              <td className="py-4 text-right">{line.quantity}</td>
              <td className="py-4 text-right">{money(line.unitPrice, data.currency)}</td>
              <td className="py-4 text-right font-bold">{money(line.total, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-6 max-w-sm">
        <Total label="Subtotal" value={money(data.subtotal, data.currency)} />
        <Total label="Discount" value={`? ${money(data.discountTotal, data.currency)}`} />
        <Total label="Tax" value={money(data.taxTotal, data.currency)} />
        <Total label="Total" value={money(data.total, data.currency)} strong />
      </div>
      {data.notes && (
        <section className="mt-10 rounded-xl bg-cloud-50 p-5">
          <h2 className="font-black">Terms & notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{data.notes}</p>
        </section>
      )}
    </article>
  );
}

export function ContractsPage(): React.JSX.Element {
  const contracts = useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiRequest<PaginatedResponse<Contract>>('/contracts'),
  });
  return (
    <div>
      <Header
        title="Contracts & renewals"
        eyebrow="Customer value"
        description="Track active commitments, renewal windows, and expansion conversations."
      />
      <div className="grid gap-4">
        {contracts.data?.data.map((contract) => (
          <article
            key={contract.id}
            className="surface grid gap-4 rounded-2xl p-5 md:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                {contract.number}
              </p>
              <h2 className="mt-1 text-lg font-black">{contract.opportunity.company.name}</h2>
              <p className="text-sm text-ink-700">
                {contract.opportunity.name} ? Owner {contract.owner.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-ink-700">Contract value</p>
              <p className="text-xl font-black">{money(contract.amount, contract.currency)}</p>
            </div>
            <div>
              <Badge value={contract.status} />
              <p className="mt-2 text-xs text-ink-700">
                Renewal{' '}
                {contract.renewalDate
                  ? new Date(contract.renewalDate).toLocaleDateString()
                  : 'not scheduled'}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Header({
  title,
  eyebrow,
  description,
  action,
  actionLabel,
}: {
  title: string;
  eyebrow: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}): React.JSX.Element {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
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
        aria-labelledby="commercial-dialog-title"
        className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
      >
        <div className="mb-6 flex justify-between">
          <h2 id="commercial-dialog-title" className="text-xl font-black">
            {title}
          </h2>
          <button onClick={close} aria-label="Close dialog">
            <X />
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
function Select({
  label,
  value,
  values,
  options,
  onChange,
}: {
  label: string;
  value: string;
  values?: string[];
  options?: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const resolved =
    options ?? values?.map((item) => ({ value: item, label: item.replace('_', ' ') })) ?? [];
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
        {resolved.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Save({ pending }: { pending: boolean }): React.JSX.Element {
  return (
    <button
      disabled={pending}
      className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white sm:col-span-2"
    >
      {pending ? 'Saving?' : 'Save'}
    </button>
  );
}
function ErrorMessage({ error }: { error: Error }): React.JSX.Element {
  return (
    <p role="alert" className="text-sm font-bold text-red-700 sm:col-span-2">
      {error instanceof ApiError ? error.message : error.message}
    </p>
  );
}
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="relative block max-w-md">
      <span className="sr-only">Search catalog</span>
      <Search className="absolute left-3 top-3 size-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search SKU, offering, or description"
        className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3"
      />
    </label>
  );
}
function Badge({ value }: { value: string }): React.JSX.Element {
  return (
    <span className="inline-block rounded-full bg-cloud-100 px-2.5 py-1 text-xs font-bold">
      {value}
    </span>
  );
}
function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`flex justify-between border-b border-slate-200 py-2 ${strong ? 'mt-2 border-t-2 border-ink-950 text-xl font-black' : 'text-sm'}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function money(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
}
