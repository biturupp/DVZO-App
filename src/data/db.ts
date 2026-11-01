import Dexie, { type EntityTable } from 'dexie';
import type { CountRecord, Duty, Line, Settings, Trip, User, Vehicle } from '../domain/types';

/**
 * Lokale Datenbank (IndexedDB) auf dem Gerät.
 * Alles wird zuerst hier gespeichert, damit die App auch ohne Empfang funktioniert.
 * Die Synchronisation mit dem Server folgt in einem späteren Schritt (Feld `synced`).
 */
export class DvzoDb extends Dexie {
  users!: EntityTable<User, 'id'>;
  vehicles!: EntityTable<Vehicle, 'id'>;
  lines!: EntityTable<Line, 'id'>;
  trips!: EntityTable<Trip, 'id'>;
  duties!: EntityTable<Duty, 'id'>;
  counts!: EntityTable<CountRecord, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

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
  }
}

export const db = new DvzoDb();

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
