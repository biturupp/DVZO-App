import { supabase } from './supabase';

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

const fromRow = (r: any): Message => ({ id: r.id, senderId: r.sender_id, recipientId: r.recipient_id, body: r.body, createdAt: r.created_at, readAt: r.read_at });

export async function sendMessage(recipientIds: string[], body: string): Promise<void> {
  const { data } = await supabase!.auth.getSession();
  const me = data.session?.user.id;
  const { error } = await supabase!.from('messages').insert(recipientIds.map((id) => ({ sender_id: me, recipient_id: id, body })));
  if (error) throw new Error(/Failed to fetch/i.test(error.message) ? 'Keine Verbindung zum Server.' : error.message);
}

export async function unreadFor(userId: string): Promise<Message[]> {
  const { data, error } = await supabase!.from('messages').select('*').eq('recipient_id', userId).is('read_at', null).order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function markRead(id: string): Promise<void> {
  await supabase!.from('messages').update({ read_at: new Date().toISOString() }).eq('id', id);
}

/** Zuletzt gesendete Nachricht pro Empfänger/in (für die Benutzerliste). */
export async function lastSentByRecipient(): Promise<Map<string, Message>> {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data } = await supabase!.from('messages').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500);
  const out = new Map<string, Message>();
  for (const r of (data ?? []).map(fromRow)) if (!out.has(r.recipientId)) out.set(r.recipientId, r);
  return out;
}

/** Neue Nachrichten live empfangen. Gibt eine Abmelde-Funktion zurück. */
export function subscribeMessages(userId: string, onMessage: (m: Message) => void): () => void {
  const ch = supabase!
    .channel(`messages-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` }, (p) => onMessage(fromRow(p.new)))
    .subscribe();
  return () => { void supabase!.removeChannel(ch); };
}
