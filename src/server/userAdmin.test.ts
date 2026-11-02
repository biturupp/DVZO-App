import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleAdmin, translateError } from './userAdmin';

/** Kleiner Ersatz für den Supabase-Admin-Client, nur was handleAdmin braucht. */
function fakeAdmin() {
  const users = new Map<string, any>([
    ['A', { id: 'A', email: 'admin@x.ch', email_confirmed_at: '2026-11-01' }],
    ['F', { id: 'F', email: 'anna@x.ch', email_confirmed_at: '2026-11-01' }],
    ['G', { id: 'G', email: 'gast@x.ch', email_confirmed_at: null }],
  ]);
  const profiles = new Map<string, any>([
    ['A', { id: 'A', name: 'Admin', role: 'admin', active: true }],
    ['F', { id: 'F', name: 'Anna', role: 'fahrer', active: true }],
    ['G', { id: 'G', name: 'Gast', role: 'fahrer', active: true }],
  ]);
  const duties = [{ driver_id: 'F' }];
  const log: string[] = [];
  const tokens: Record<string, string> = { tA: 'A', tF: 'F' };
  const query = (table: string) => {
    const rows = () => (table === 'profiles' ? [...profiles.values()] : table === 'duties' ? duties : []);
    let filters: [string, unknown][] = [];
    let inF: [string, unknown[]] | null = null;
    let patch: any = null;
    let head = false;
    const q: any = {
      select: (_c: string, o?: { head?: boolean }) => { head = !!o?.head; return q; },
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      in: (k: string, v: unknown[]) => { inF = [k, v]; return q; },
      update: (p: any) => { patch = p; return q; },
      upsert: (r: any) => { profiles.set(r.id, { ...profiles.get(r.id), ...r }); return Promise.resolve({ error: null }); },
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null }),
      then: (res: any) => res(head ? { count: run().length } : patch ? (run().forEach((r: any) => Object.assign(r, patch)), { error: null }) : { data: run() }),
    };
    const run = () => rows().filter((r: any) => filters.every(([k, v]) => r[k] === v) && (!inF || inF[1].includes(r[inF[0]])));
    return q;
  };
  const client = {
    from: query,
    auth: {
      getUser: async (t: string) => (tokens[t] ? { data: { user: users.get(tokens[t]) }, error: null } : { data: { user: null }, error: { message: 'bad' } }),
      resetPasswordForEmail: async (e: string) => { log.push(`reset ${e}`); return { error: null }; },
      admin: {
        listUsers: async () => ({ data: { users: [...users.values()] }, error: null }),
        getUserById: async (id: string) => ({ data: { user: users.get(id) ?? null } }),
        inviteUserByEmail: async (email: string, o: any) => {
          log.push(`invite ${email}`);
          const existing = [...users.values()].find((u) => u.email === email);
          if (existing?.email_confirmed_at) return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } };
          const u = existing ?? { id: 'N', email, email_confirmed_at: null, user_metadata: o.data };
          users.set(u.id, u);
          if (!profiles.has(u.id)) profiles.set(u.id, { id: u.id, name: o.data.name, role: 'fahrer', active: true });
          return { data: { user: u }, error: null };
        },
        updateUserById: async (id: string, a: any) => { users.get(id).banned_until = '2999-01-01'; log.push(`ban ${id} ${a.ban_duration}`); return { error: null }; },
        deleteUser: async (id: string) => { users.delete(id); profiles.delete(id); log.push(`delete ${id}`); return { error: null }; },
      },
    },
  };
  return { client: client as unknown as SupabaseClient, log, profiles };
}

const R = 'https://dvzo.netlify.app';

describe('Benutzerverwaltung (Server)', () => {
  it('lässt nur Admins zu', async () => {
    const f = fakeAdmin();
    expect((await handleAdmin(f.client, null, { action: 'list' }, R)).status).toBe(401);
    expect((await handleAdmin(f.client, 'tF', { action: 'list' }, R)).status).toBe(403);
    const r = await handleAdmin(f.client, 'tA', { action: 'list' }, R);
    expect(r.status).toBe(200);
    expect(r.body.ok && r.body.users?.map((u) => `${u.name}:${u.role}:${u.confirmed}`)).toEqual(['Admin:admin:true', 'Anna:fahrer:true', 'Gast:fahrer:false']);
  });

  it('legt an, lädt ein und setzt die Rolle', async () => {
    const f = fakeAdmin();
    const r = await handleAdmin(f.client, 'tA', { action: 'create', email: ' Neu@X.ch ', name: 'Neu', role: 'dispo' }, R);
    expect(r.status).toBe(200);
    expect(f.log).toContain('invite neu@x.ch');
    expect(f.profiles.get('N')).toMatchObject({ name: 'Neu', role: 'dispo' });
    const dup = await handleAdmin(f.client, 'tA', { action: 'create', email: 'anna@x.ch', name: 'Anna', role: 'fahrer' }, R);
    expect(dup.body).toEqual({ ok: false, error: 'Für diese E-Mail-Adresse gibt es schon ein Konto.' });
  });

  it('sendet Einladung erneut oder Passwort-Link', async () => {
    const f = fakeAdmin();
    await handleAdmin(f.client, 'tA', { action: 'invite', id: 'G' }, R);
    await handleAdmin(f.client, 'tA', { action: 'invite', id: 'F' }, R);
    expect(f.log).toEqual(['invite gast@x.ch', 'reset anna@x.ch']);
  });

  it('schützt das eigene Konto', async () => {
    const f = fakeAdmin();
    expect((await handleAdmin(f.client, 'tA', { action: 'update', id: 'A', role: 'fahrer' }, R)).status).toBe(400);
    expect((await handleAdmin(f.client, 'tA', { action: 'delete', id: 'A' }, R)).status).toBe(400);
  });

  it('sperrt statt löscht, wenn Dienste vorhanden sind', async () => {
    const f = fakeAdmin();
    const r1 = await handleAdmin(f.client, 'tA', { action: 'delete', id: 'F' }, R);
    expect(f.log).toContain('ban F 876000h');
    expect(r1.body.ok && r1.body.user?.active).toBe(false);
    await handleAdmin(f.client, 'tA', { action: 'delete', id: 'G' }, R);
    expect(f.log).toContain('delete G');
  });

  it('übersetzt E-Mail-Fehler', () => {
    expect(translateError('Email rate limit exceeded')).toMatch(/Limit/);
  });
});
