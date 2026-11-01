import type { DvzoDb } from './db';
import { uid } from './db';
import type { CountRecord, Duty, DutyItem, DutyType, Line, Trip, User, Vehicle } from '../domain/types';
import { hm, isoDate } from '../domain/time';

/**
 * Beispieldaten für den Testbetrieb. Haltestellen und Koordinaten sind Platzhalter
 * und werden im Modul «Linien» durch die echten DVZO-Daten ersetzt.
 */
export function buildSampleData(today = new Date()) {
  const L1: Line = {
    id: 'L1', name: 'Linie 1', route: 'Steg – Hulftegg – Mühlrüti', color: '#1d6b50', days: 'Mo–Fr',
    stops: [
      { id: 's1', name: 'Steg, Bahnhof', lat: 47.35, lon: 8.932, radius: 200 },
      { id: 's2', name: 'Steg, Säge', lat: 47.3575, lon: 8.9475, radius: 200 },
      { id: 's3', name: 'Hulftegg, Passhöhe', lat: 47.3868, lon: 8.969, radius: 200 },
      { id: 's4', name: 'Mühlrüti, Dorf', lat: 47.3975, lon: 8.995, radius: 200 },
    ],
  };
  const L2: Line = {
    id: 'L2', name: 'Linie 2', route: 'Mühlrüti – Libingen', color: '#b5562a', days: 'Mo–Fr',
    stops: [
      { id: 's5', name: 'Mühlrüti, Dorf', lat: 47.3975, lon: 8.995, radius: 200 },
      { id: 's6', name: 'Wiesen, Abzweigung', lat: 47.3925, lon: 9.012, radius: 200 },
      { id: 's7', name: 'Libingen, Kirche', lat: 47.387, lon: 9.027, radius: 200 },
    ],
  };
  const lines = [L1, L2];
  const trips: Trip[] = [];
  const mk = (L: Line, dir: 'H' | 'R', starts: number[], offs: number[]) => {
    const st = dir === 'H' ? L.stops : [...L.stops].reverse();
    starts.forEach((s, n) => {
      const times: Record<string, number> = {};
      st.forEach((x, i) => (times[x.id] = s + offs[i]));
      // Kursnummern: Hinrichtung ungerade, Rückrichtung gerade
      const number = String(dir === 'H' ? 2 * n + 1 : 2 * n + 2);
      trips.push({ id: `${L.id}-${dir}-${hm(s).replace(':', '')}`, lineId: L.id, dir, times, number, calendarId: null });
    });
  };
  mk(L1, 'H', [425, 545, 785, 905, 1025], [0, 7, 19, 27]);
  mk(L1, 'R', [460, 580, 820, 940, 1060], [0, 8, 20, 27]);
  mk(L2, 'H', [660, 840], [0, 6, 12]);
  mk(L2, 'R', [680, 860], [0, 6, 12]);

  const users: User[] = [
    { id: 'u1', name: 'Disposition', role: 'admin', pin: '1234' },
    { id: 'u2', name: 'Anna Keller', role: 'fahrer', pin: '1111' },
    { id: 'u3', name: 'Marco Brunner', role: 'fahrer', pin: '2222' },
  ];
  const vehicles: Vehicle[] = [
    { id: 'v1', name: 'Bus 1', seats: 16 },
    { id: 'v2', name: 'Bus 2', seats: 16 },
  ];
  const it = (type: DutyType, start: string | null, end: string | null, note = '', tripId: string | null = null): DutyItem => ({
    id: uid('i'), type, start, end, note, tripId,
  });
  const f = (tripId: string) => it('fahrt', null, null, '', tripId);
  const date = isoDate(today);
  const duties: Duty[] = [
    {
      id: 'd1', sample: true, date, driverId: 'u2', vehicleId: 'v1',
      items: [
        it('anfahrt', '06:40', '07:00', 'Depot → Steg, Bahnhof'), f('L1-H-0705'), f('L1-R-0740'),
        it('pause', '08:10', '08:50', 'Steg, Bahnhof'), f('L1-H-0905'), f('L1-R-0940'),
        it('tanken', '10:10', '10:25', 'Tankstelle Steg'),
        it('wechsel', '10:30', '10:55', 'Leerfahrt nach Mühlrüti, weiter auf Linie 2'),
        f('L2-H-1100'), f('L2-R-1120'), it('pause', '11:35', '12:15', 'Mühlrüti'),
        it('putzen', '12:20', '12:40', 'Innenreinigung'), it('rueckfahrt', '12:45', '13:05', 'Mühlrüti → Depot'),
      ],
    },
    {
      id: 'd2', sample: true, date, driverId: 'u3', vehicleId: 'v2',
      items: [
        it('anfahrt', '12:40', '13:00', 'Depot → Steg, Bahnhof'), f('L1-H-1305'), f('L1-R-1340'),
        it('pause', '14:10', '14:50', 'Steg, Bahnhof'), f('L1-H-1505'), f('L1-R-1540'), f('L1-H-1705'), f('L1-R-1740'),
        it('putzen', '18:10', '18:30', 'Aussenreinigung'), it('rueckfahrt', '18:35', '18:55', 'Steg → Depot'),
      ],
    },
  ];

  // Beispiel-Zählungen vom Vortag, damit die Auswertung nicht leer ist
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yDate = isoDate(y);
  let r = 7;
  const rnd = (n: number) => {
    r = (r * 9301 + 49297) % 233280;
    return Math.floor((r / 233280) * (n + 1));
  };
  const counts: CountRecord[] = [];
  for (const d of duties) {
    for (const item of d.items.filter((i) => i.type === 'fahrt')) {
      const tr = trips.find((t) => t.id === item.tripId)!;
      const L = lines.find((l) => l.id === tr.lineId)!;
      const st = tr.dir === 'H' ? L.stops : [...L.stops].reverse();
      let a = 0;
      let k = 0;
      st.forEach((s, idx) => {
        const last = idx === st.length - 1;
        const adultsOut = last ? a : Math.min(a, rnd(2));
        const kidsOut = last ? k : Math.min(k, rnd(1));
        a -= adultsOut;
        k -= kidsOut;
        const adultsIn = last ? 0 : rnd(4);
        const kidsIn = last ? 0 : rnd(2);
        a += adultsIn;
        k += kidsIn;
        counts.push({
          id: uid('c'), sample: true, date: yDate, dutyId: d.id, tripId: tr.id, lineId: L.id, stopId: s.id, stopName: s.name, idx,
          adultsIn, adultsOut, kidsIn, kidsOut, time: tr.times[s.id] + rnd(3), delay: rnd(3) - 1,
          userId: d.driverId, vehicleId: d.vehicleId, emptied: last,
        });
      });
    }
  }
  return { lines, trips, users, vehicles, duties, counts };
}

/** Füllt eine leere Datenbank mit Beispieldaten und verschiebt Beispieldienste auf heute. */
export async function ensureSeeded(db: DvzoDb, reset = false) {
  await db.transaction('rw', [db.users, db.vehicles, db.lines, db.trips, db.duties, db.counts, db.settings], async () => {
    if (reset) await Promise.all([db.users, db.vehicles, db.lines, db.trips, db.duties, db.counts, db.settings].map((t) => t.clear()));
    if ((await db.users.count()) === 0) {
      const s = buildSampleData();
      await db.users.bulkAdd(s.users);
      await db.vehicles.bulkAdd(s.vehicles);
      await db.lines.bulkAdd(s.lines);
      await db.trips.bulkAdd(s.trips);
      await db.duties.bulkAdd(s.duties);
      await db.counts.bulkAdd(s.counts);
      await db.settings.put({ id: 'settings', remindMinutes: 3 });
    } else {
      const today = isoDate(new Date());
      await db.duties.filter((d) => !!d.sample && d.date !== today).modify({ date: today });
    }
  });
}
