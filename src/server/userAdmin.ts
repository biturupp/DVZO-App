/**
 * Benutzerverwaltung auf dem Server (Netlify-Funktion «users»).
 * Braucht den geheimen Service-Schlüssel von Supabase und läuft deshalb nie im Browser.
 * Jede Anfrage trägt das Anmelde-Token der aufrufenden Person; nur aktive Admins dürfen etwas tun.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminRole = 'admin' | 'dispo' | 'fahrer';
const ROLES: AdminRole[] = ['admin', 'dispo', 'fahrer'];

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  /** Einladung angenommen (Passwort gesetzt). */
  confirmed: boolean;
  invitedAt: string | null;
  lastSignIn: string | null;
}

export type AdminRequest =
  | { action: 'list' }
  | { action: 'create'; email: string; name: string; role: AdminRole }
  | { action: 'update'; id: string; name?: string; role?: AdminRole }
  | { action: 'invite'; id: string }
  | { action: 'delete'; id: string };

export interface AdminResult {
  status: number;
  body: { ok: true; users?: AdminUser[]; user?: AdminUser; note?: string } | { ok: false; error: string };
}

const fail = (status: number, error: string): AdminResult => ({ status, body: { ok: false, error } });

/** Fehlermeldungen von Supabase für die Oberfläche übersetzen. */
export function translateError(m: string): string {
  if (/already been registered|already registered|already exists/i.test(m)) return 'Für diese E-Mail-Adresse gibt es schon ein Konto.';
  if (/rate limit/i.test(m)) return 'Supabase hat das Limit für E-Mails erreicht. Bitte später erneut versuchen oder einen eigenen E-Mail-Versand (SMTP) in Supabase einrichten.';
  if (/not authorized|Email address .* cannot be used/i.test(m)) return 'Supabase verschickt ohne eigenen E-Mail-Versand (SMTP) nur an Mitglieder des Supabase-Teams. Bitte in Supabase unter Authentication → Emails → SMTP einen Versand einrichten.';
  if (/invalid.*email|unable to validate email/i.test(m)) return 'Die E-Mail-Adresse ist ungültig.';
  return m;
}

export async function handleAdmin(admin: SupabaseClient, token: string | null, req: AdminRequest, redirectTo: string): Promise<AdminResult> {
  if (!token) return fail(401, 'Nicht angemeldet.');
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who.user) return fail(401, 'Anmeldung abgelaufen. Bitte neu anmelden.');
  const me = who.user.id;
  const { data: myProfile } = await admin.from('profiles').select('role,active').eq('id', me).maybeSingle();
  if (!myProfile || myProfile.role !== 'admin' || !myProfile.active) return fail(403, 'Nur die Administration darf Benutzer verwalten.');

  const loadOne = async (id: string): Promise<AdminUser | null> => {
    const { data } = await admin.auth.admin.getUserById(id);
    if (!data.user) return null;
    const { data: p } = await admin.from('profiles').select('name,role,active').eq('id', id).maybeSingle();
    return toAdminUser(data.user, p);
  };

  switch (req.action) {
    case 'list': {
      const users: AdminUser[] = [];
      for (let page = 1; page < 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return fail(500, translateError(error.message));
        const { data: profiles } = await admin.from('profiles').select('id,name,role,active').in('id', data.users.map((u) => u.id));
        const byId = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));
        users.push(...data.users.map((u) => toAdminUser(u, byId.get(u.id) as ProfileRow | undefined)));
        if (data.users.length < 200) break;
      }
      users.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      return { status: 200, body: { ok: true, users } };
    }
    case 'create': {
      const email = req.email?.trim().toLowerCase();
      const name = req.name?.trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'Bitte eine gültige E-Mail-Adresse eingeben.');
      if (!name) return fail(400, 'Bitte einen Namen eingeben.');
      if (!ROLES.includes(req.role)) return fail(400, 'Unbekannte Rolle.');
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo });
      if (error || !data.user) return fail(400, translateError(error?.message ?? 'Einladung fehlgeschlagen.'));
      // Das Profil legt der Datenbank-Trigger an (als Fahrer/in); Rolle und Name hier setzen.
      const { error: pErr } = await admin.from('profiles').upsert({ id: data.user.id, name, role: req.role, active: true });
      if (pErr) return fail(500, pErr.message);
      return { status: 200, body: { ok: true, user: (await loadOne(data.user.id)) ?? undefined, note: `Einladung an ${email} verschickt.` } };
    }
    case 'update': {
      const patch: Record<string, unknown> = {};
      if (req.name !== undefined) {
        if (!req.name.trim()) return fail(400, 'Der Name darf nicht leer sein.');
        patch.name = req.name.trim();
      }
      if (req.role !== undefined) {
        if (!ROLES.includes(req.role)) return fail(400, 'Unbekannte Rolle.');
        if (req.id === me && req.role !== 'admin') return fail(400, 'Die eigene Admin-Rolle kann man nicht selbst entfernen.');
        patch.role = req.role;
      }
      const { error } = await admin.from('profiles').update(patch).eq('id', req.id);
      if (error) return fail(500, error.message);
      return { status: 200, body: { ok: true, user: (await loadOne(req.id)) ?? undefined } };
    }
    case 'invite': {
      const u = await loadOne(req.id);
      if (!u) return fail(404, 'Benutzer nicht gefunden.');
      if (!u.active) return fail(400, 'Das Konto ist gesperrt.');
      // Noch nicht angenommen: Einladung erneut senden. Sonst: Link zum Setzen eines neuen Passworts.
      const { error } = u.confirmed
        ? await admin.auth.resetPasswordForEmail(u.email, { redirectTo })
        : await admin.auth.admin.inviteUserByEmail(u.email, { data: { name: u.name }, redirectTo });
      if (error) return fail(400, translateError(error.message));
      return {
        status: 200,
        body: { ok: true, user: u, note: u.confirmed ? `E-Mail zum Setzen eines neuen Passworts an ${u.email} verschickt.` : `Einladung erneut an ${u.email} verschickt.` },
      };
    }
    case 'delete': {
      if (req.id === me) return fail(400, 'Das eigene Konto kann man nicht löschen.');
      const u = await loadOne(req.id);
      if (!u) return fail(404, 'Benutzer nicht gefunden.');
      // Wer schon Dienste oder Zählungen hat, wird gesperrt statt gelöscht, damit die Auswertungen erhalten bleiben.
      const [{ count: duties }, { count: counts }] = await Promise.all([
        admin.from('duties').select('id', { count: 'exact', head: true }).eq('driver_id', req.id),
        admin.from('counts').select('id', { count: 'exact', head: true }).eq('user_id', req.id),
      ]);
      if ((duties ?? 0) + (counts ?? 0) > 0) {
        const { error } = await admin.auth.admin.updateUserById(req.id, { ban_duration: '876000h' });
        if (error) return fail(500, error.message);
        await admin.from('profiles').update({ active: false }).eq('id', req.id);
        return { status: 200, body: { ok: true, user: (await loadOne(req.id)) ?? undefined, note: `${u.name} hat bereits Dienste oder Zählungen und wurde deshalb gesperrt statt gelöscht.` } };
      }
      const { error } = await admin.auth.admin.deleteUser(req.id);
      if (error) return fail(500, error.message);
      return { status: 200, body: { ok: true, note: `${u.name} gelöscht.` } };
    }
    default:
      return fail(400, 'Unbekannte Aktion.');
  }
}

type ProfileRow = { name?: string; role?: AdminRole; active?: boolean };
type AuthUser = { id: string; email?: string; email_confirmed_at?: string | null; invited_at?: string | null; last_sign_in_at?: string | null; banned_until?: string | null; user_metadata?: { name?: string } };

function toAdminUser(u: AuthUser, p: ProfileRow | null | undefined): AdminUser {
  const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
  return {
    id: u.id,
    email: u.email ?? '',
    name: p?.name || u.user_metadata?.name || (u.email ?? '').split('@')[0],
    role: p?.role ?? 'fahrer',
    active: (p?.active ?? true) && !banned,
    confirmed: !!u.email_confirmed_at,
    invitedAt: u.invited_at ?? null,
    lastSignIn: u.last_sign_in_at ?? null,
  };
}
