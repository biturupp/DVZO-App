import type { AdminRequest, AdminUser } from '../server/userAdmin';
import { supabase } from './supabase';

export type { AdminUser };

/** Ruft die Netlify-Funktion «users» mit dem eigenen Anmelde-Token auf. */
export async function callAdmin(req: AdminRequest): Promise<{ users?: AdminUser[]; user?: AdminUser; note?: string }> {
  const { data } = await supabase!.auth.getSession();
  let res: Response;
  try {
    res = await fetch('/.netlify/functions/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify(req),
    });
  } catch {
    throw new Error('Keine Verbindung zum Server. Bitte Empfang prüfen.');
  }
  const body = await res.json().catch(() => null);
  if (!body) throw new Error(res.status === 404 ? 'Die Server-Funktion «users» ist nicht erreichbar (nur auf Netlify verfügbar).' : `Serverfehler ${res.status}`);
  if (!body.ok) throw new Error(body.error);
  return body;
}
