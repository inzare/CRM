import type { PaginatedResponse } from '@consultflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Globe2, Plus, Search, UserRoundPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { ApiError, apiRequest } from '../lib/api';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  updatedAt: string;
  owner: { id: string; name: string };
  tags: Array<{ tag: { id: string; name: string; color: string | null } }>;
  _count: { contacts: number; opportunities: number };
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  jobTitle: string | null;
  isDecisionMaker: boolean;
}

const emptyCompany = { name: '', industry: '', website: '', city: '', country: '', tags: '' };

export function CompaniesPage(): React.JSX.Element {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Company | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    isDecisionMaker: false,
  });
  const companies = useQuery({
    queryKey: ['companies', search],
    queryFn: () =>
      apiRequest<PaginatedResponse<Company>>(
        `/companies?search=${encodeURIComponent(search)}&direction=asc`,
      ),
  });
  const contacts = useQuery({
    queryKey: ['company-contacts', selected?.id],
    enabled: Boolean(selected),
    queryFn: () =>
      apiRequest<PaginatedResponse<Contact>>(`/companies/${String(selected?.id)}/contacts`),
  });
  const createCompany = useMutation({
    mutationFn: () =>
      apiRequest<{ company: Company; duplicateSuggestions: Array<Pick<Company, 'id' | 'name'>> }>(
        '/companies',
        {
          method: 'POST',
          body: JSON.stringify({
            ...companyForm,
            tags: companyForm.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          }),
        },
      ),
    onSuccess: async ({ company, duplicateSuggestions }) => {
      setSelected(company);
      setShowCreate(false);
      setCompanyForm(emptyCompany);
      await client.invalidateQueries({ queryKey: ['companies'] });
      if (duplicateSuggestions.length)
        window.alert(
          `Similar company found: ${duplicateSuggestions.map((item) => item.name).join(', ')}`,
        );
    },
  });
  const createContact = useMutation({
    mutationFn: () =>
      apiRequest<Contact>('/contacts', {
        method: 'POST',
        body: JSON.stringify({ ...contactForm, companyId: selected?.id }),
      }),
    onSuccess: async () => {
      setShowContact(false);
      setContactForm({
        firstName: '',
        lastName: '',
        email: '',
        jobTitle: '',
        isDecisionMaker: false,
      });
      await client.invalidateQueries({ queryKey: ['company-contacts', selected?.id] });
      await client.invalidateQueries({ queryKey: ['companies'] });
    },
  });
  const submitCompany = (event: FormEvent) => {
    event.preventDefault();
    createCompany.mutate();
  };
  const submitContact = (event: FormEvent) => {
    event.preventDefault();
    createContact.mutate();
  };
  const error =
    createCompany.error instanceof ApiError
      ? createCompany.error.message
      : createContact.error instanceof ApiError
        ? createContact.error.message
        : '';

  return (
    <div>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">
            Relationships
          </p>
          <h1 className="mt-2 text-3xl font-black text-ink-950">Companies & contacts</h1>
          <p className="mt-2 text-sm text-ink-700">
            Keep account context, stakeholders, and activity in one place.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" />
          New company
        </button>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-slate-200 p-4">
            <label className="relative block max-w-md">
              <span className="sr-only">Search companies</span>
              <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company, industry, or notes"
                className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm"
              />
            </label>
          </div>
          {companies.isLoading ? (
            <p className="p-8 text-sm">Loading customer records?</p>
          ) : companies.isError ? (
            <p role="alert" className="p-8 text-sm font-semibold text-red-700">
              Customer records could not be loaded.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {companies.data?.data.map((company) => (
                <li key={company.id}>
                  <button
                    onClick={() => setSelected(company)}
                    className={`grid w-full gap-3 p-5 text-left transition sm:grid-cols-[1fr_auto] ${selected?.id === company.id ? 'bg-teal-50' : 'hover:bg-cloud-50'}`}
                  >
                    <span>
                      <span className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-cloud-100 text-ink-700">
                          <Building2 className="size-5" />
                        </span>
                        <span>
                          <span className="block font-extrabold text-ink-950">{company.name}</span>
                          <span className="text-sm text-ink-700">
                            {company.industry ?? 'Industry not set'} ? {company.owner.name}
                          </span>
                        </span>
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        {company.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-cloud-100 px-2.5 py-1 text-xs font-bold text-ink-700"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="self-center text-sm text-ink-700">
                      {company._count.contacts} contacts
                      <br />
                      {company._count.opportunities} opportunities
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="surface h-fit rounded-2xl p-5 xl:sticky xl:top-8">
          {!selected ? (
            <div className="py-12 text-center">
              <Building2 className="mx-auto size-8 text-slate-400" />
              <p className="mt-3 font-bold text-ink-950">Select a company</p>
              <p className="mt-1 text-sm text-ink-700">
                Contact and ownership context will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-ink-950">{selected.name}</h2>
                  <p className="mt-1 text-sm text-ink-700">
                    {[selected.city, selected.country].filter(Boolean).join(', ') ||
                      'Location not set'}
                  </p>
                </div>
                {selected.website && (
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${selected.name} website`}
                    className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"
                  >
                    <Globe2 className="size-5" />
                  </a>
                )}
              </div>
              <div className="my-5 border-t border-slate-200" />
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-ink-950">Contacts</h3>
                <button
                  onClick={() => setShowContact(true)}
                  className="flex items-center gap-1 text-xs font-bold text-teal-600"
                >
                  <UserRoundPlus className="size-4" />
                  Add
                </button>
              </div>
              {contacts.isLoading ? (
                <p className="mt-4 text-sm">Loading?</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {contacts.data?.data.map((contact) => (
                    <li key={contact.id} className="rounded-xl bg-cloud-50 p-3">
                      <span className="font-bold text-ink-950">
                        {contact.firstName} {contact.lastName}
                      </span>
                      {contact.isDecisionMaker && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">
                          Decision maker
                        </span>
                      )}
                      <span className="block text-xs text-ink-700">
                        {contact.jobTitle ?? contact.email ?? 'No details'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
      {(showCreate || showContact) && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/55 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-dialog-title"
            className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <h2 id="customer-dialog-title" className="text-xl font-black text-ink-950">
                {showCreate ? 'Create company' : `Add contact to ${String(selected?.name)}`}
              </h2>
              <button
                aria-label="Close dialog"
                onClick={() => {
                  setShowCreate(false);
                  setShowContact(false);
                }}
                className="rounded-lg p-2 hover:bg-cloud-100"
              >
                <X className="size-5" />
              </button>
            </div>
            {showCreate ? (
              <form onSubmit={submitCompany} className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Company name"
                  required
                  value={companyForm.name}
                  onChange={(name) => setCompanyForm({ ...companyForm, name })}
                />
                <Field
                  label="Industry"
                  value={companyForm.industry}
                  onChange={(industry) => setCompanyForm({ ...companyForm, industry })}
                />
                <Field
                  label="Website"
                  type="url"
                  placeholder="https://"
                  value={companyForm.website}
                  onChange={(website) => setCompanyForm({ ...companyForm, website })}
                />
                <Field
                  label="City"
                  value={companyForm.city}
                  onChange={(city) => setCompanyForm({ ...companyForm, city })}
                />
                <Field
                  label="Country"
                  value={companyForm.country}
                  onChange={(country) => setCompanyForm({ ...companyForm, country })}
                />
                <Field
                  label="Tags"
                  placeholder="Priority, Mexico"
                  value={companyForm.tags}
                  onChange={(tags) => setCompanyForm({ ...companyForm, tags })}
                />
                <Submit pending={createCompany.isPending} />
              </form>
            ) : (
              <form onSubmit={submitContact} className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  required
                  value={contactForm.firstName}
                  onChange={(firstName) => setContactForm({ ...contactForm, firstName })}
                />
                <Field
                  label="Last name"
                  required
                  value={contactForm.lastName}
                  onChange={(lastName) => setContactForm({ ...contactForm, lastName })}
                />
                <Field
                  label="Email"
                  type="email"
                  value={contactForm.email}
                  onChange={(email) => setContactForm({ ...contactForm, email })}
                />
                <Field
                  label="Job title"
                  value={contactForm.jobTitle}
                  onChange={(jobTitle) => setContactForm({ ...contactForm, jobTitle })}
                />
                <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={contactForm.isDecisionMaker}
                    onChange={(event) =>
                      setContactForm({ ...contactForm, isDecisionMaker: event.target.checked })
                    }
                  />
                  Decision maker
                </label>
                <Submit pending={createContact.isPending} />
              </form>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
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
    <label className="grid gap-2 text-sm font-semibold text-ink-900">
      {label}
      <input
        {...props}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-slate-300 px-3"
      />
    </label>
  );
}
function Submit({ pending }: { pending: boolean }): React.JSX.Element {
  return (
    <div className="sm:col-span-2">
      <button
        disabled={pending}
        className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white"
      >
        {pending ? 'Saving?' : 'Save record'}
      </button>
    </div>
  );
}
