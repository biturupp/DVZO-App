import type { LatLon } from './geo';
import { distanceM } from './geo';
import type { CountRecord, Stop } from './types';
import type { ResolvedItem } from './schedule';

/** Linienfahrten werden so viele Minuten vor Abfahrt aktiv (Anfahrt zur Starthaltestelle, Einsteigen). */
export const PRE_TRIP_MINUTES = 15;
/** Toleranz für «im Fahrplan» in Minuten. */
export const ON_TIME_TOLERANCE = 1;

export interface Occupancy {
  adults: number;
  kids: number;
}

export function occupancy(records: CountRecord[]): Occupancy {
  let adults = 0;
  let kids = 0;
  for (const r of records) {
    adults += r.adultsIn - r.adultsOut;
    kids += r.kidsIn - r.kidsOut;
  }
  return { adults, kids };
}

export function currentAndNext(items: ResolvedItem[], now: number) {
  const current = items.find((i) => i.s <= now && now < i.e) ?? null;
  const next = items.find((i) => i.s > now) ?? null;
  return { current, next };
}

/**
 * Bestimmt die Linienfahrt, auf der gezählt wird.
 * Reihenfolge: laufende Fahrt → eben beendete Fahrt (solange noch Fahrgäste an Bord sind, max. 8 Min.)
 * → nächste Fahrt, die in höchstens 15 Minuten beginnt.
 */
export function pickActiveTrip(
  items: ResolvedItem[],
  now: number,
  keptTripId: string | null,
  occupancyOf: (tripId: string) => Occupancy,
): ResolvedItem | null {
  const trips = items.filter((i) => i.type === 'fahrt' && i.trip && i.line);
  const running = trips.find((i) => i.s <= now && now < i.e);
  if (running) return running;
  if (keptTripId) {
    const kept = trips.find((i) => i.tripId === keptTripId);
    if (kept) {
      const o = occupancyOf(kept.tripId!);
      if (now <= kept.e + 1 || (now <= kept.e + 8 && o.adults + o.kids > 0)) return kept;
    }
  }
  return trips.find((i) => i.s > now && i.s - now <= PRE_TRIP_MINUTES) ?? null;
}

/** Index der nächstgelegenen Haltestelle, in deren Radius die Position liegt, sonst −1. */
export function stopInRadius(stops: Stop[], pos: LatLon | null): number {
  if (!pos) return -1;
  let best = -1;
  let bestD = Infinity;
  stops.forEach((s, i) => {
    const d = distanceM(pos, s);
    if (d <= (s.radius || 200) && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

export type LageKind = 'pre' | 'wait' | 'at' | 'run' | 'end';

export interface Lage {
  kind: LageKind;
  /** Minuten: + verspätet / zu langsam, − zu früh / zu schnell. Bei «pre» und «wait»: −Restzeit bis Abfahrt. */
  value: number | null;
  idx?: number;
}

/**
 * Fahrplanlage.
 * - An einer Haltestelle: Jetzt minus Fahrplanzeit dieser Haltestelle.
 * - Zwischen zwei Haltestellen: Sollzeit wird nach zurückgelegter Distanz interpoliert.
 */
export function computeLage(
  stops: Stop[],
  times: number[],
  pos: LatLon | null,
  atIdx: number,
  lastIdx: number,
  now: number,
): Lage {
  const last = stops.length - 1;
  if (atIdx >= 0) {
    if (atIdx < last && now < times[atIdx]) return { kind: 'wait', value: now - times[atIdx], idx: atIdx };
    if (atIdx === last && atIdx > 0 && lastIdx >= atIdx && now > times[atIdx] + 0.5) return { kind: 'end', value: null };
    return { kind: 'at', value: now - times[atIdx], idx: atIdx };
  }
  if (lastIdx < 0) return { kind: 'pre', value: now - times[0] };
  if (lastIdx >= last) return { kind: 'end', value: null };
  if (!pos) return { kind: 'run', value: null };
  const a = stops[lastIdx];
  const b = stops[lastIdx + 1];
  const da = distanceM(pos, a);
  const db = distanceM(pos, b);
  const f = da / (da + db || 1);
  const expected = times[lastIdx] + f * (times[lastIdx + 1] - times[lastIdx]);
  return { kind: 'run', value: now - expected };
}

export type LageStatus = 'ok' | 'late' | 'early' | 'wait' | 'none';

export function lageStatus(l: Lage | null): LageStatus {
  if (!l || l.value == null) return l?.kind === 'end' ? 'ok' : 'none';
  if (l.kind === 'pre' || l.kind === 'wait') return l.kind === 'wait' && (l.idx ?? 0) > 0 ? 'early' : 'wait';
  if (Math.abs(l.value) <= ON_TIME_TOLERANCE) return 'ok';
  return l.value > 0 ? 'late' : 'early';
}

/** Wert für das Speichern in der Zählung: nur echte Abweichungen, keine Wartezeiten. */
export function lageForRecord(l: Lage | null): number | null {
  if (!l || l.value == null || (l.kind !== 'at' && l.kind !== 'run')) return null;
  return Math.round(l.value * 10) / 10;
}

/** Simulierte Fahrzeugposition entlang des Kurses (für Tests ohne GPS). delay in Minuten. */
export function simulatePosition(stops: Stop[], times: number[], now: number, delay: number): LatLon | null {
  if (!stops.length) return null;
  const t = now - delay;
  if (t <= times[0]) return stops[0];
  if (t >= times[times.length - 1]) return stops[stops.length - 1];
  let k = 0;
  while (k < times.length - 1 && !(times[k] <= t && t < times[k + 1])) k++;
  const dwell = 0.6;
  const f = Math.max(0, Math.min(1, (t - times[k] - dwell) / Math.max(0.1, times[k + 1] - times[k] - dwell)));
  return {
    lat: stops[k].lat + (stops[k + 1].lat - stops[k].lat) * f,
    lon: stops[k].lon + (stops[k + 1].lon - stops[k].lon) * f,
  };
}

export interface Reminder {
  key: string;
  time: number;
  text: string;
}

/** Nächste Abfahrt, an die erinnert werden soll, wenn sie innerhalb von `windowMin` liegt. */
export function dueReminder(
  active: ResolvedItem | null,
  stops: Stop[],
  times: number[],
  atIdx: number,
  lastIdx: number,
  next: ResolvedItem | null,
  nextTitle: string,
  now: number,
  windowMin: number,
): Reminder | null {
  let dep: Reminder | null = null;
  if (active && stops.length) {
    const i = atIdx >= 0 ? atIdx : lastIdx < 0 ? 0 : -1;
    if (i >= 0 && i < stops.length - 1 && now < times[i]) {
      dep = { key: `${active.tripId}:${i}`, time: times[i], text: `Abfahrt ${active.line?.name ?? ''} ab ${stops[i].name}` };
    }
  }
  if (!dep && next) dep = { key: next.id, time: next.s, text: next.type === 'fahrt' ? `Abfahrt ${nextTitle}` : `${nextTitle} beginnt` };
  if (dep && dep.time - now > 0 && dep.time - now <= windowMin) return dep;
  return null;
}
