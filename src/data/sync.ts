import { db, SYNC_TABLES, type SyncTable } from './db';
import { fromRow, profileToUser, toRow } from './mapping';
import { supabase } from './supabase';

/**
 * Abgleich mit dem Server («offline zuerst»):
 * 1. Lokale Änderungen (_dirty) und Löschungen hochladen.
 * 2. Serverstand herunterladen und lokal ersetzen; noch nicht hochgeladene Datensätze bleiben erhalten.
 * Zugriffsregeln (welche Dienste/Zählungen jemand sieht) setzt der Server durch.
 */

export interface SyncStatus {
  online: boolean;
  pending: number;
  lastSync: Date | null;
  error: string;
}

let status: SyncStatus = { online: navigator.onLine, pending: 0, lastSync: null, error: '' };
const listeners = new Set<(s: SyncStatus) => void>();
const emit = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
};
export const onSyncStatus = (l: (s: SyncStatus) => void) => {
  listeners.add(l);
  l(status);
  return () => {
    listeners.delete(l);
  };
};

/** Ältere Zählungen werden nicht laufend neu geladen (die Auswertung lädt bei Bedarf). */
const COUNT_DAYS = 14;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

async function countPending() {
  const n = await Promise.all(SYNC_TABLES.map((t) => db.table(t).where('_dirty').equals(1).count()));
  return n.reduce((a, b) => a + b, 0) + (await db.tombstones.count());
}

/** Reihenfolge wegen Fremdschlüsseln: zuerst Stammdaten, zuletzt Zählungen. */
const PUSH_ORDER: SyncTable[] = ['calendars', 'vehicles', 'lines', 'trips', 'duties', 'counts'];

async function push() {
  const sb = supabase!;
  for (const t of PUSH_ORDER) {
    const rows = await db.table(t).where('_dirty').equals(1).toArray();
    if (!rows.length) continue;
    const { error } = await sb.from(t).upsert(rows.map(toRow[t]));
    if (error) throw new Error(`${t}: ${error.message}`);
    db.applyingRemote = true;
    try {
      await db.transaction('rw', db.table(t), async () => {
        for (const r of rows) {
          const cur = await db.table(t).get(r.id);
          // nur zurücksetzen, wenn seitdem nicht erneut geändert
          if (cur && JSON.stringify({ ...cur, _dirty: 0 }) === JSON.stringify({ ...r, _dirty: 0 })) await db.table(t).update(r.id, { _dirty: 0 });
        }
      });
    } finally {
      db.applyingRemote = false;
    }
  }
  for (const tb of await db.tombstones.toArray()) {
    const { error } = await sb.from(tb.table).delete().eq('id', tb.key);
    if (error) throw new Error(`${tb.table}: ${error.message}`);
    await db.tombstones.delete(tb.id!);
  }
}

async function pull() {
  const sb = supabase!;
  const [profiles, calendars, vehicles, lines, trips, duties, counts] = await Promise.all([
    sb.from('profiles').select('id,name,role'),
    sb.from('calendars').select('*'),
    sb.from('vehicles').select('*'),
    sb.from('lines').select('*'),
    sb.from('trips').select('*'),
    sb.from('duties').select('*').gte('date', daysAgo(COUNT_DAYS)),
    sb.from('counts').select('*').gte('date', daysAgo(COUNT_DAYS)),
  ]);
  for (const r of [profiles, calendars, vehicles, lines, trips, duties, counts]) if (r.error) throw new Error(r.error.message);

  db.applyingRemote = true;
  try {
    await db.transaction('rw', [db.users, db.calendars, db.vehicles, db.lines, db.trips, db.duties, db.counts], async () => {
      await db.users.clear();
      await db.users.bulkPut(profiles.data!.map(profileToUser));
      const replace = async (t: SyncTable, rows: unknown[], keepOlder?: (r: { date?: string }) => boolean) => {
        const table = db.table(t);
        const dirty = new Set((await table.where('_dirty').equals(1).primaryKeys()).map(String));
        const serverIds = new Set(rows.map((r: any) => r.id as string));
        // Lokal vorhandene, auf dem Server gelöschte Datensätze entfernen (ausser ungesendete)
        const stale = (await table.toArray()).filter((r: any) => !serverIds.has(r.id) && !dirty.has(r.id) && !(keepOlder?.(r) ?? false));
        await table.bulkDelete(stale.map((r: any) => r.id));
        await table.bulkPut(rows.map((r: any) => ({ ...(fromRow[t](r) as object), _dirty: 0 })).filter((r: any) => !dirty.has(r.id)));
      };
      const older = (r: { date?: string }) => !!r.date && r.date < daysAgo(COUNT_DAYS);
      await replace('calendars', calendars.data!);
      await replace('vehicles', vehicles.data!);
      await replace('lines', lines.data!);
      await replace('trips', trips.data!);
      await replace('duties', duties.data!, older);
      await replace('counts', counts.data!, older);
    });
  } finally {
    db.applyingRemote = false;
  }
}

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    try {
      if (!navigator.onLine) {
        emit({ online: false, pending: await countPending() });
        return;
      }
      const { data } = await supabase!.auth.getSession();
      if (!data.session) return;
      await push();
      await pull();
      emit({ online: true, pending: await countPending(), lastSync: new Date(), error: '' });
    } catch (e) {
      emit({ pending: await countPending(), error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Lädt Zählungen eines beliebigen Zeitraums für die Auswertung nach. */
export async function fetchCountsRange(from: string, to: string) {
  if (!supabase || !navigator.onLine) return;
  const { data, error } = await supabase.from('counts').select('*').gte('date', from).lte('date', to);
  if (error || !data) return;
  db.applyingRemote = true;
  try {
    const dirty = new Set((await db.counts.where('_dirty').equals(1).primaryKeys()).map(String));
    await db.counts.bulkPut(data.map((r) => ({ ...(fromRow.counts(r) as object), _dirty: 0 }) as never).filter((r: any) => !dirty.has(r.id)));
  } finally {
    db.applyingRemote = false;
  }
}

let started = false;

/** Startet den Hintergrundabgleich: sofort, alle 30 s, bei wiederhergestellter Verbindung und kurz nach lokalen Änderungen. */
export function startSync() {
  if (!supabase || started) return;
  started = true;
  void syncNow();
  setInterval(() => void syncNow(), 30000);
  addEventListener('online', () => { emit({ online: true }); void syncNow(); });
  addEventListener('offline', () => emit({ online: false }));
  let t: ReturnType<typeof setTimeout> | undefined;
  const soon = () => { clearTimeout(t); t = setTimeout(() => void syncNow(), 1500); };
  for (const name of SYNC_TABLES) {
    const table = db.table(name);
    table.hook('creating', () => { if (!db.applyingRemote) soon(); });
    table.hook('updating', () => { if (!db.applyingRemote) soon(); return undefined; });
    table.hook('deleting', () => { if (!db.applyingRemote) soon(); });
  }
}
