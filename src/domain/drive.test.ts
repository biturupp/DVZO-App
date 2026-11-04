import { describe, expect, it } from 'vitest';
import { bandProgress, computeLage, dueReminder, lageForRecord, lageStatus, occupancy, pickActiveTrip, simulatePosition, stopInRadius } from './drive';
import { resolveItems, tripStops, tripTimes } from './schedule';
import type { CountRecord, Duty, Line, Stop, Trip } from './types';

const line: Line = {
  id: 'L1', name: 'Linie 1', route: 'A – C', color: '#000', days: 'So',
  stops: [
    { id: 'a', name: 'A', lat: 47.35, lon: 8.93, radius: 200 },
    { id: 'b', name: 'B', lat: 47.36, lon: 8.95, radius: 200 },
    { id: 'c', name: 'C', lat: 47.39, lon: 8.99, radius: 200 },
  ],
};
const trip: Trip = { id: 'T1', lineId: 'L1', dir: 'H', times: { a: 600, b: 610, c: 630 } };
const back: Trip = { id: 'T2', lineId: 'L1', dir: 'R', times: { c: 640, b: 660, a: 670 } };
const duty: Duty = {
  id: 'd', date: '2026-11-01', driverId: 'u', vehicleId: 'v',
  items: [
    { id: 'i1', type: 'fahrt', start: null, end: null, note: '', tripId: 'T1' },
    { id: 'i2', type: 'fahrt', start: null, end: null, note: '', tripId: 'T2' },
    { id: 'i3', type: 'pause', start: '11:15', end: '11:45', note: '', tripId: null },
  ],
};
const items = resolveItems(duty, [trip, back], [line]);
const none = () => ({ adults: 0, kids: 0 });
const rec = (p: Partial<CountRecord>): CountRecord => ({
  id: 'r', date: '', dutyId: 'd', tripId: 'T1', lineId: 'L1', stopId: 'a', stopName: 'A', idx: 0,
  adultsIn: 0, adultsOut: 0, kidsIn: 0, kidsOut: 0, time: 0, delay: null, userId: 'u', vehicleId: 'v', emptied: false, ...p,
});

describe('Fahrplan', () => {
  it('dreht die Haltestellen für die Rückrichtung', () => {
    expect(tripStops(back, line).map((s) => s.id)).toEqual(['c', 'b', 'a']);
    expect(tripTimes(back, line)).toEqual([640, 660, 670]);
  });
  it('leitet Start und Ende von Linienfahrten aus dem Kurs ab', () => {
    expect(items.map((i) => [i.s, i.e])).toEqual([[600, 630], [640, 670], [675, 705]]);
  });
});

describe('aktive Fahrt', () => {
  it('öffnet die Fahrt 15 Minuten vor Abfahrt', () => {
    expect(pickActiveTrip(items, 584, null, none)).toBeNull();
    expect(pickActiveTrip(items, 586, null, none)?.tripId).toBe('T1');
  });
  it('hält eine beendete Fahrt offen, solange noch Fahrgäste an Bord sind', () => {
    const full = () => ({ adults: 2, kids: 0 });
    expect(pickActiveTrip(items, 635, 'T1', full)?.tripId).toBe('T1');
    expect(pickActiveTrip(items, 635, 'T1', none)?.tripId).toBe('T2');
  });
});

describe('Haltestellen-Radius', () => {
  it('erkennt das Fahrzeug innerhalb von 200 m', () => {
    expect(stopInRadius(line.stops, { lat: 47.3515, lon: 8.93 })).toBe(0); // ~167 m
    expect(stopInRadius(line.stops, { lat: 47.3525, lon: 8.93 })).toBe(-1); // ~278 m
  });
});

describe('Fahrplanlage', () => {
  const st = line.stops;
  const t = [600, 610, 630];
  it('zeigt Wartezeit an der Starthaltestelle', () => {
    const l = computeLage(st, t, st[0], 0, 0, 597);
    expect(l).toEqual({ kind: 'wait', value: -3, idx: 0 });
    expect(lageStatus(l)).toBe('wait');
    expect(lageForRecord(l)).toBeNull();
  });
  it('meldet Verspätung an einer Haltestelle', () => {
    const l = computeLage(st, t, st[1], 1, 1, 612.5);
    expect(l.value).toBeCloseTo(2.5);
    expect(lageStatus(l)).toBe('late');
  });
  it('interpoliert zwischen Haltestellen', () => {
    const mid = { lat: (st[1].lat + st[2].lat) / 2, lon: (st[1].lon + st[2].lon) / 2 };
    const l = computeLage(st, t, mid, -1, 1, 617);
    expect(l.value).toBeCloseTo(-3, 0); // Soll 620, ist 617 → zu schnell
    expect(lageStatus(l)).toBe('early');
  });
  it('erkennt das Ende der Strecke', () => {
    expect(computeLage(st, t, st[2], 2, 2, 631).kind).toBe('end');
  });
});

describe('Besetzung', () => {
  it('summiert Ein- und Aussteigende, «Fahrzeug leeren» bringt sie auf null', () => {
    const r = [rec({ adultsIn: 3, kidsIn: 2 }), rec({ adultsOut: 1, kidsIn: 1 })];
    expect(occupancy(r)).toEqual({ adults: 2, kids: 3 });
    expect(occupancy([...r, rec({ adultsOut: 2, kidsOut: 3, emptied: true })])).toEqual({ adults: 0, kids: 0 });
  });
});

describe('Simulation und Erinnerung', () => {
  it('fährt das simulierte Fahrzeug nach Fahrplan', () => {
    expect(simulatePosition(line.stops, [600, 610, 630], 599, 0)).toEqual(line.stops[0]);
    expect(simulatePosition(line.stops, [600, 610, 630], 640, 0)).toEqual(line.stops[2]);
  });
  it('erinnert an die nächste Abfahrt im Zeitfenster', () => {
    const r = dueReminder(items[0], line.stops, [600, 610, 630], 0, 0, items[0], 'Linie 1', 598, 3);
    expect(r?.text).toBe('Abfahrt Linie 1 ab A');
    expect(dueReminder(items[0], line.stops, [600, 610, 630], 0, 0, items[0], 'Linie 1', 590, 3)).toBeNull();
  });
});

describe('Ankunft und Abfahrt verschieden', () => {
  const st = line.stops;
  // B: Ankunft 610, Abfahrt 615 (5 Min. Aufenthalt)
  const dep = [600, 615, 630];
  const arr = [600, 610, 630];
  it('rechnet unterwegs mit der Ankunftszeit', () => {
    const mid = { lat: (st[0].lat + st[1].lat) / 2, lon: (st[0].lon + st[1].lon) / 2 };
    expect(computeLage(st, dep, mid, -1, 0, 605, arr).value).toBeCloseTo(0, 0);
  });
  it('wartet an der Haltestelle bis zur Abfahrt', () => {
    const l = computeLage(st, dep, st[1], 1, 1, 611, arr);
    expect(l.kind).toBe('wait');
    expect(lageStatus(l)).toBe('early');
  });
  it('steht in der Simulation während des Aufenthalts an der Haltestelle', () => {
    expect(simulatePosition(st, dep, 612, 0, arr)).toEqual(st[1]);
  });
  it('nimmt die Ankunft an der Endhaltestelle als Dienstende', () => {
    const t: Trip = { id: 'T3', lineId: 'L1', dir: 'H', times: { a: 600, b: 615, c: 630 }, arrivals: { b: 610 } };
    const d: Duty = { ...duty, items: [{ id: 'x', type: 'fahrt', start: null, end: null, note: '', tripId: 'T3' }] };
    expect(resolveItems(d, [t], [line]).map((i) => [i.s, i.e])).toEqual([[600, 630]]);
  });
});

describe('bandProgress', () => {
  const s = (id: string, lat: number): Stop => ({ id, name: id, lat, lon: 8.9, radius: 100 });
  const stops = [s('a', 47.30), s('b', 47.31), s('c', 47.32)];
  it('steht an der Haltestelle', () => expect(bandProgress(stops, null, 1, 1)).toBe(1));
  it('vor der Fahrt am Start', () => expect(bandProgress(stops, { lat: 47.29, lon: 8.9 }, -1, -1)).toBe(0));
  it('unterwegs auf halbem Weg', () => expect(bandProgress(stops, { lat: 47.305, lon: 8.9 }, -1, 0)).toBeCloseTo(0.5, 1));
  it('nach der Endhaltestelle am Ende', () => expect(bandProgress(stops, null, -1, 2)).toBe(2));
  it('ohne Haltestellen 0', () => expect(bandProgress([], null, -1, -1)).toBe(0));
});
