import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Minimaler Supabase-Ersatz im Speicher
const server: Record<string, Map<string, any>> = {};
const tbl = (t: string) => (server[t] ??= new Map());
const query = (t: string) => {
  const filters: ((r: any) => boolean)[] = [];
  const q: any = {
    select: () => q,
    gte: (c: string, v: string) => (filters.push((r) => r[c] >= v), q),
    lte: (c: string, v: string) => (filters.push((r) => r[c] <= v), q),
    eq: (c: string, v: string) => (filters.push((r) => r[c] === v), q),
    upsert: async (rows: any[]) => (rows.forEach((r) => tbl(t).set(r.id, r)), { error: null }),
    delete: () => ({ eq: async (_c: string, v: string) => (tbl(t).delete(v), { error: null }) }),
    then: (res: any) => res({ data: [...tbl(t).values()].filter((r) => filters.every((f) => f(r))), error: null }),
  };
  return q;
};
vi.mock('./supabase', () => ({
  serverMode: true,
  supabase: { from: (t: string) => query(t), auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } },
}));
vi.stubGlobal('navigator', { onLine: true });
vi.stubGlobal('addEventListener', () => {});

const { db } = await import('./db');
const { syncNow } = await import('./sync');
const wait = () => new Promise((r) => setTimeout(r, 10));
const today = new Date().toISOString().slice(0, 10);

describe('Abgleich mit dem Server', () => {
  beforeAll(() => {
    tbl('profiles').set('u1', { id: 'u1', name: 'Anna', role: 'fahrer' });
    tbl('lines').set('L1', { id: 'L1', name: 'Linie 1', route: '', color: '#000', days: '', stops: [] });
    tbl('duties').set('d1', { id: 'd1', date: today, driver_id: 'u1', vehicle_id: null, items: [] });
  });

  it('lädt Serverdaten herunter, ohne sie als geändert zu markieren', async () => {
    await syncNow();
    expect((await db.lines.get('L1'))?._dirty).toBe(0);
    expect((await db.users.get('u1'))?.name).toBe('Anna');
    expect(await db.duties.count()).toBe(1);
  });

  it('lädt eine neue Zählung hoch und markiert sie als übertragen', async () => {
    await db.counts.add({
      id: 'c1', date: today, dutyId: 'd1', tripId: 'T', lineId: 'L1', stopId: 's', stopName: 'S', idx: 0,
      adultsIn: 3, adultsOut: 0, kidsIn: 1, kidsOut: 0, time: 600, delay: 1.5, userId: 'u1', vehicleId: '', emptied: false,
    });
    expect((await db.counts.get('c1'))?._dirty).toBe(1);
    await syncNow();
    expect(tbl('counts').get('c1')).toMatchObject({ adults_in: 3, kids_in: 1, delay: 1.5, duty_id: 'd1' });
    expect((await db.counts.get('c1'))?._dirty).toBe(0);
  });

  it('überträgt Löschungen und entfernt auf dem Server gelöschte Datensätze', async () => {
    await db.counts.delete('c1');
    await wait();
    await syncNow();
    expect(tbl('counts').has('c1')).toBe(false);
    tbl('lines').delete('L1');
    await syncNow();
    expect(await db.lines.get('L1')).toBeUndefined();
  });

  it('behält offline erfasste Zählungen, bis sie übertragen sind', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await db.counts.add({
      id: 'c2', date: today, dutyId: 'd1', tripId: 'T', lineId: 'L1', stopId: 's', stopName: 'S', idx: 0,
      adultsIn: 2, adultsOut: 0, kidsIn: 0, kidsOut: 0, time: 610, delay: null, userId: 'u1', vehicleId: '', emptied: false,
    });
    await syncNow();
    expect(tbl('counts').has('c2')).toBe(false);
    vi.stubGlobal('navigator', { onLine: true });
    await syncNow();
    expect(tbl('counts').has('c2')).toBe(true);
  });
});
