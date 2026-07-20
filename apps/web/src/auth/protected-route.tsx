import type { Role } from '@consultflow/contracts';
import { Navigate } from 'react-router-dom';

import { useAuth } from './auth-context';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}): React.JSX.Element {
  const { loading, user } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-cloud-50 text-sm font-semibold text-ink-700">
        Loading your workspace?
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <main className="grid min-h-[60vh] place-items-center p-8 text-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-teal-600">Access denied</p>
          <h1 className="mt-3 text-3xl font-black text-ink-950">
            This area is not available for your role.
          </h1>
          <p className="mt-3 text-ink-700">
            Return to your dashboard or ask an administrator if your responsibilities changed.
          </p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
