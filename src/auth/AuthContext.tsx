import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from '../data/db';
import { profileToUser } from '../data/mapping';
import { serverMode, supabase } from '../data/supabase';
import { startSync, syncNow } from '../data/sync';
import type { User } from '../domain/types';

/**
 * Anmeldung.
 * - Serverbetrieb (Supabase): E-Mail und Passwort, Konto pro Person, Einladung durch die Disposition.
 * - Lokaler Testbetrieb: Beispielpersonen mit PIN.
 * Der Rest der App nutzt ausschliesslich `useAuth()`.
 */
interface AuthState {
  user: User | null;
  /** true nach Einladungs- oder Zurücksetzen-Link: Passwort muss gesetzt werden. */
  mustSetPassword: boolean;
  loginPin: (userId: string, pin: string) => Promise<boolean>;
  loginEmail: (email: string, password: string) => Promise<string | null>;
  sendReset: (email: string) => Promise<string | null>;
  setPassword: (password: string) => Promise<string | null>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const KEY = 'dvzo-user';
// Einladungs- und Zurücksetzen-Links tragen den Typ im Adress-Fragment, bevor Supabase es ausliest.
const linkType = /type=(invite|recovery)/.exec(location.hash)?.[1] ?? null;

const msg = (m: string) =>
  /Failed to fetch|NetworkError/i.test(m) ? 'Keine Verbindung zum Server. Bitte Empfang prüfen.' : /Invalid login/i.test(m) ? 'E-Mail oder Passwort stimmt nicht.' : /Email not confirmed/i.test(m) ? 'Bitte zuerst den Link in der E-Mail bestätigen.' : m;

async function loadProfile(id: string): Promise<User | null> {
  const local = await db.users.get(id);
  if (navigator.onLine && supabase) {
    const { data } = await supabase.from('profiles').select('id,name,role').eq('id', id).maybeSingle();
    if (data) {
      const u = profileToUser(data);
      await db.users.put(u);
      return u;
    }
  }
  return local ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mustSetPassword, setMust] = useState(!!linkType);

  useEffect(() => {
    if (serverMode && supabase) {
      const apply = async (id: string | undefined) => {
        const u = id ? await loadProfile(id) : null;
        setUser(u);
        setReady(true);
        if (u) startSync();
      };
      supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id));
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setMust(true);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void apply(session?.user.id);
      });
      return () => sub.subscription.unsubscribe();
    }
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

  const loginPin = useCallback(async (userId: string, pin: string) => {
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

  const loginEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    return error ? msg(error.message) : null;
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
    return error ? msg(error.message) : null;
  }, []);

  const setPassword = useCallback(async (password: string) => {
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) return msg(error.message);
    setMust(false);
    void syncNow();
    return null;
  }, []);

  const logout = useCallback(() => {
    if (supabase) {
      void supabase.auth.signOut();
      // Daten der abgemeldeten Person vom Gerät entfernen, ausser noch nicht übertragene
      void Promise.all(['duties', 'counts'].map((t) => db.table(t).filter((r) => r._dirty !== 1).delete()));
    }
    setUser(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignorieren */
    }
  }, []);

  if (!ready) return null;
  return <Ctx.Provider value={{ user, mustSetPassword, loginPin, loginEmail, sendReset, setPassword, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth ausserhalb von AuthProvider');
  return c;
}
