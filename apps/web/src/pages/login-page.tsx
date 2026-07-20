import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';

import { Logo } from '../components/logo';

export function LoginPage(): React.JSX.Element {
  return (
    <main className="grid min-h-screen bg-cloud-50 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 top-24 size-96 rounded-full border border-teal-500/25" />
        <div className="absolute -right-12 top-44 size-72 rounded-full bg-teal-500/10 blur-2xl" />
        <Logo />
        <div className="relative max-w-xl">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-amber-400">
            Revenue, relationships, delivery
          </p>
          <h1 className="text-5xl font-black leading-[1.06] tracking-[-0.04em]">
            Move every consulting opportunity forward.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            One focused workspace for customer context, sales decisions, quotes, tasks, and
            renewals.
          </p>
          <ul className="mt-10 grid gap-4 text-sm text-slate-200">
            {[
              'A pipeline grounded in real activity',
              'Versioned commercial proposals',
              'Renewal and follow-up signals that stay visible',
            ].map((item) => (
              <li className="flex items-center gap-3" key={item}>
                <CheckCircle2 className="size-5 text-teal-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Secure access ? Role-aware views ? Audited changes</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden">
            <Logo />
          </div>
          <div className="mb-8">
            <span className="mb-5 grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-600">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-3xl font-black tracking-tight text-ink-950">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-ink-700">
              Sign in to continue to your ConsultFlow workspace.
            </p>
          </div>
          <form className="grid gap-5" aria-label="Sign in">
            <label className="grid gap-2 text-sm font-semibold text-ink-900">
              Email address
              <input
                className="h-12 rounded-xl border border-slate-300 bg-white px-4 shadow-sm transition focus:border-teal-500"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink-900">
              Password
              <input
                className="h-12 rounded-xl border border-slate-300 bg-white px-4 shadow-sm transition focus:border-teal-500"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-700">
                <input className="size-4 accent-teal-600" type="checkbox" />
                Remember this browser
              </label>
              <a
                className="font-bold text-teal-600 underline-offset-4 hover:underline"
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </div>
            <button
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 font-bold text-white shadow-lg shadow-ink-950/15 transition hover:bg-ink-900"
              type="submit"
            >
              Sign in
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </form>
          <p className="mt-8 border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-500">
            Access is managed by your ConsultFlow administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
