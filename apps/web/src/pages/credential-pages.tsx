import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Logo } from '../components/logo';
import { ApiError, apiRequest } from '../lib/api';

function CredentialLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-cloud-50 p-6">
      <section className="surface w-full max-w-md rounded-3xl p-7 sm:p-9">
        <Logo />
        <h1 className="mt-10 text-3xl font-black text-ink-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-700">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

export function ForgotPasswordPage(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await apiRequest(
      '/auth/password-reset/request',
      { method: 'POST', body: JSON.stringify({ email }) },
      false,
    );
    setSent(true);
  };
  return (
    <CredentialLayout
      title="Reset your password"
      description="Enter your email. Eligible accounts receive a single-use link."
    >
      {sent ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
        >
          If the account is eligible, instructions are on the way.
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 px-3"
            />
          </label>
          <button className="mt-5 w-full rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white">
            Send reset link
          </button>
        </form>
      )}
      <Link className="mt-6 block text-center text-sm font-bold text-teal-600" to="/login">
        Back to sign in
      </Link>
    </CredentialLayout>
  );
}

export function SetPasswordPage({
  invitation = false,
}: {
  invitation?: boolean;
}): React.JSX.Element {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await apiRequest(
        `/auth/${invitation ? 'invitations/accept' : 'password-reset/confirm'}`,
        { method: 'POST', body: JSON.stringify({ token: params.get('token') ?? '', password }) },
        false,
      );
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'This link could not be used.');
    }
  };
  return (
    <CredentialLayout
      title={invitation ? 'Join ConsultFlow' : 'Choose a new password'}
      description="Use 12+ characters with uppercase, lowercase, a number, and a symbol."
    >
      {complete ? (
        <div>
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
          >
            Your password is ready.
          </p>
          <Link className="mt-5 block text-center text-sm font-bold text-teal-600" to="/login">
            Continue to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800"
            >
              {error}
            </p>
          )}
          <label className="grid gap-2 text-sm font-semibold">
            New password
            <input
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 px-3"
            />
          </label>
          <button className="mt-5 w-full rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white">
            Set password
          </button>
        </form>
      )}
    </CredentialLayout>
  );
}
