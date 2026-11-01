import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DvzoDb } from './db';
import { ensureSeeded } from './seed';
import { occupancy } from '../domain/drive';

describe('Beispieldaten', () => {
  it('füllt die Datenbank und jede Beispielfahrt endet leer', async () => {
    const db = new DvzoDb('test-seed');
    await ensureSeeded(db);
    expect(await db.lines.count()).toBe(2);
    expect(await db.duties.count()).toBe(2);
    const counts = await db.counts.toArray();
    const byTrip = new Map<string, typeof counts>();
    counts.forEach((c) => byTrip.set(c.dutyId + c.tripId, [...(byTrip.get(c.dutyId + c.tripId) ?? []), c]));
    for (const recs of byTrip.values()) expect(occupancy(recs)).toEqual({ adults: 0, kids: 0 });
    await ensureSeeded(db); // zweiter Aufruf fügt nichts doppelt ein
    expect(await db.lines.count()).toBe(2);
  });
});
