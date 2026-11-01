import { useCallback, useEffect, useState } from 'react';
import { useUsers } from '../../data/hooks';
import { markRead, subscribeMessages, unreadFor, type Message } from '../../data/messages';
import { beep } from '../../ui/sound';

const POLL_MS = 60_000;

/** Zeigt ungelesene Sofortnachrichten als Popup, live und beim Öffnen der App. */
export function MessagePopup({ userId }: { userId: string }) {
  const users = useUsers();
  const [queue, setQueue] = useState<Message[]>([]);

  const add = useCallback((ms: Message[]) => {
    setQueue((q) => {
      const known = new Set(q.map((m) => m.id));
      const fresh = ms.filter((m) => !known.has(m.id) && !m.readAt);
      if (fresh.length) beep();
      return fresh.length ? [...q, ...fresh] : q;
    });
  }, []);

  useEffect(() => {
    const load = () => { if (navigator.onLine) unreadFor(userId).then(add).catch(() => {}); };
    load();
    const off = subscribeMessages(userId, (m) => add([m]));
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('online', load);
    return () => { off(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); removeEventListener('online', load); };
  }, [userId, add]);

  const m = queue[0];
  if (!m) return null;
  const sender = users.find((u) => u.id === m.senderId)?.name ?? 'Disposition';
  const time = new Date(m.createdAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', hour12: false });
  const done = () => { void markRead(m.id); setQueue((q) => q.slice(1)); };
  return (
    <div className="overlay">
      <div className="panel stack msgpop" role="alertdialog" aria-labelledby="msg-h" aria-describedby="msg-b">
        <h2 id="msg-h" className="sec m0">Nachricht von {sender}</h2>
        <p className="note m0">{time} Uhr{queue.length > 1 ? ` · noch ${queue.length - 1} weitere` : ''}</p>
        <p id="msg-b" className="msgbody">{m.body}</p>
        <button className="btn pri big" autoFocus onClick={done}>OK, gelesen</button>
      </div>
    </div>
  );
}
