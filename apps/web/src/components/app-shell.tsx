import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';

import { Logo } from './logo';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/leads', label: 'Leads', icon: Target, roles: ['ADMIN', 'MANAGER', 'SALES'] },
  { to: '/pipeline', label: 'Pipeline', icon: BarChart3, roles: ['ADMIN', 'MANAGER', 'SALES'] },
  { to: '/catalog', label: 'Catalog', icon: Package, roles: ['ADMIN', 'MANAGER', 'SALES'] },
  { to: '/quotes', label: 'Quotes', icon: FileText, roles: ['ADMIN', 'MANAGER', 'SALES'] },
  { to: '/tasks', label: 'Tasks', icon: ClipboardCheck },
  { to: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
] as const;

export function AppShell(): React.JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return <Outlet />;

  const items = navigation.filter(
    (item) => !('roles' in item) || item.roles.includes(user.role as never),
  );
  const signOut = async () => {
    await logout();
    void navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-cloud-50 lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:hidden">
        <Logo />
        <button
          aria-label="Toggle navigation"
          className="rounded-lg p-2 text-ink-900"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside
        className={`${open ? 'fixed inset-0 top-16 z-40 flex' : 'hidden'} flex-col border-r border-slate-800 bg-ink-950 text-white lg:sticky lg:top-0 lg:flex lg:h-screen`}
      >
        <div className="hidden h-20 items-center border-b border-white/10 px-6 lg:flex">
          <Logo />
        </div>
        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 px-3 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-500">
            Workspace
          </p>
          <ul className="grid gap-1">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  onClick={() => setOpen(false)}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-teal-500 text-white shadow-lg shadow-teal-950/30' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`
                  }
                >
                  <Icon className="size-[1.1rem]" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-4">
          <NavLink
            to="/profile"
            className="mb-2 flex items-center gap-3 rounded-xl p-3 hover:bg-white/5"
          >
            <span className="grid size-9 place-items-center rounded-full bg-white/10">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{user.name}</span>
              <span className="block text-xs text-slate-400">{user.role}</span>
            </span>
          </NavLink>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <main id="main-content" className="mx-auto max-w-[1600px] p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
