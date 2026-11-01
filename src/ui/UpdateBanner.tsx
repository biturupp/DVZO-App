import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const startedAt = Date.now();
/** Innerhalb dieser Zeit nach dem Öffnen wird eine neue Version ohne Rückfrage geladen. */
const AUTO_WINDOW_MS = 20_000;
const CHECK_EVERY_MS = 5 * 60_000;

/**
 * Sucht regelmässig nach einer neuen App-Version.
 * Kurz nach dem Öffnen wird sie sofort geladen, sonst erscheint ein Hinweis,
 * damit niemand mitten in einer Zählung unterbrochen wird.
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    const apply = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (Date.now() - startedAt < AUTO_WINDOW_MS) void apply(true);
        else setUpdate(() => apply);
      },
      onRegisteredSW(_url, r) {
        reg = r;
      },
    });
    const check = () => { if (navigator.onLine) void reg?.update().catch(() => {}); };
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (!update) return null;
  return (
    <div className="update-banner" role="status">
      <span>Eine neue Version der DVZO-App ist bereit.</span>
      <button className="btn sm pri" onClick={() => void update(true)}>Jetzt aktualisieren</button>
    </div>
  );
}
