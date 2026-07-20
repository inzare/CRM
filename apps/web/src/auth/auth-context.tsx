import type { Role } from '@consultflow/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { apiRequest, registerRefreshHandler, setAccessToken } from '../lib/api';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  updateUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const refresh = useCallback((): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const request = (async () => {
      try {
        const session = await apiRequest<SessionResponse>(
          '/auth/refresh',
          { method: 'POST' },
          false,
        );
        setAccessToken(session.accessToken);
        setUser(session.user);
        return true;
      } catch {
        setAccessToken(null);
        setUser(null);
        return false;
      }
    })();
    refreshInFlight.current = request;
    void request.finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    });
    return request;
  }, []);

  useEffect(() => registerRefreshHandler(refresh), [refresh]);
  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const session = await apiRequest<SessionResponse>(
          '/auth/login',
          { method: 'POST', body: JSON.stringify({ email, password }) },
          false,
        );
        setAccessToken(session.accessToken);
        setUser(session.user);
      },
      async logout() {
        try {
          await apiRequest<void>('/auth/logout', { method: 'POST' }, false);
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
      refresh,
      updateUser: setUser,
    }),
    [loading, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
