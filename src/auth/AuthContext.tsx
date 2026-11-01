import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from '../data/db';
import type { User } from '../domain/types';

/**
 * Anmeldung. Im Moment lokal mit PIN (Testbetrieb).
 * Für den Serverbetrieb wird nur dieser Kontext ausgetauscht (z. B. Supabase Auth);
 * der Rest der App nutzt ausschliesslich `useAuth()`.
 */
interface AuthState {
  user: User | null;
  login: (userId: string, pin: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const KEY = 'dvzo-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(KEY);
    } catch {
      /* ignorieren */
    }
    (id ? db.users.get(id) : Promise.resolve(undefined)).then((u) => {
      setUser(u ?? null);
      setReady(true);
    });
  }, []);

  const login = useCallback(async (userId: string, pin: string) => {
    const u = await db.users.get(userId);
    if (!u || u.pin !== pin) return false;
    setUser(u);
    try {
      sessionStorage.setItem(KEY, u.id);
    } catch {
      /* ignorieren */
    }
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignorieren */
    }
  }, []);

  if (!ready) return null;
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth ausserhalb von AuthProvider');
  return c;
}
