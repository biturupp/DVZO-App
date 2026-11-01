import Dexie, { type EntityTable } from 'dexie';
import type { CountRecord, Duty, Line, Settings, Trip, User, Vehicle } from '../domain/types';

/** Tabellen, die mit dem Server abgeglichen werden. */
export const SYNC_TABLES = ['lines', 'trips', 'vehicles', 'duties', 'counts'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Markiert lokal geänderte Datensätze, die noch nicht beim Server sind. */
export interface Dirty {
  _dirty?: 0 | 1;
}

/** Gelöschter Datensatz, dessen Löschung noch an den Server gehen muss. */
export interface Tombstone {
  id?: number;
  table: SyncTable;
  key: string;
}

/**
 * Lokale Datenbank (IndexedDB) auf dem Gerät.
 * Alles wird zuerst hier gespeichert, damit die App auch ohne Empfang funktioniert.
 * Im Serverbetrieb gleicht `sync.ts` geänderte Datensätze (`_dirty = 1`) und Löschungen (`tombstones`) ab.
 */
export class DvzoDb extends Dexie {
  users!: EntityTable<User, 'id'>;
  vehicles!: EntityTable<Vehicle & Dirty, 'id'>;
  lines!: EntityTable<Line & Dirty, 'id'>;
  trips!: EntityTable<Trip & Dirty, 'id'>;
  duties!: EntityTable<Duty & Dirty, 'id'>;
  counts!: EntityTable<CountRecord & Dirty, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  tombstones!: EntityTable<Tombstone, 'id'>;

  /** true, während Serverdaten eingespielt werden (dann nichts als geändert markieren). */
  applyingRemote = false;

  constructor(name = 'dvzo-app') {
    super(name);
    this.version(1).stores({
      users: 'id',
      vehicles: 'id',
      lines: 'id',
      trips: 'id, lineId',
      duties: 'id, date, driverId',
      counts: 'id, date, tripId, dutyId, lineId, synced',
      settings: 'id',
    });
    this.version(2).stores({
      vehicles: 'id, _dirty',
      lines: 'id, _dirty',
      trips: 'id, lineId, _dirty',
      duties: 'id, date, driverId, _dirty',
      counts: 'id, date, tripId, dutyId, lineId, _dirty',
      tombstones: '++id, table',
    });

    for (const t of SYNC_TABLES) {
      const table = this.table(t);
      table.hook('creating', (_key, obj) => {
        if (!this.applyingRemote) (obj as Dirty)._dirty = 1;
      });
      table.hook('updating', (mods) => {
        if (this.applyingRemote || '_dirty' in (mods as object)) return undefined;
        return { _dirty: 1 };
      });
      table.hook('deleting', (key) => {
        if (this.applyingRemote) return;
        // ausserhalb der laufenden Transaktion vormerken
        setTimeout(() => void this.tombstones.add({ table: t, key: String(key) }), 0);
      });
    }
  }
}

export const db = new DvzoDb();

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
