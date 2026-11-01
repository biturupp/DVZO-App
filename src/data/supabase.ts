import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase-Client, falls Server-Zugangsdaten gesetzt sind (Netlify: Umgebungsvariablen).
 * Ohne Zugangsdaten läuft die App im lokalen Testbetrieb mit Beispieldaten.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export const serverMode = !!supabase;
