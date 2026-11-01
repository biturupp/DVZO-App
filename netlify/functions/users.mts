// Netlify-Funktion für die Benutzerverwaltung: /.netlify/functions/users
// Der geheime Service-Schlüssel steht nur in Netlify (Umgebungsvariable SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from '@supabase/supabase-js';
import { handleAdmin, type AdminRequest } from '../../src/server/userAdmin';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://nlluqztynqtzothmcbfu.supabase.co';

export default async (req: Request): Promise<Response> => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Nur POST' });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return json(500, { ok: false, error: 'In Netlify fehlt die Umgebungsvariable SUPABASE_SERVICE_ROLE_KEY. Siehe supabase/EINRICHTEN.md.' });
  }
  let body: AdminRequest;
  try {
    body = (await req.json()) as AdminRequest;
  } catch {
    return json(400, { ok: false, error: 'Ungültige Anfrage' });
  }
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  try {
    const r = await handleAdmin(admin, token, body, origin);
    return json(r.status, r.body);
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
