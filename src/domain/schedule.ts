import type { Duty, DutyItem, Line, Stop, Trip } from './types';
import { DUTY_TYPES } from './types';
import { hm, parseHm } from './time';

/** Haltestellen eines Kurses in Fahrtrichtung. */
export function tripStops(trip: Trip, line: Line | undefined): Stop[] {
  if (!line) return [];
  return trip.dir === 'H' ? line.stops : [...line.stops].reverse();
}

/** Zeiten eines Kurses in Fahrtrichtung. Fehlende Zeiten (neue Haltestelle) werden mit +3 Min. ergänzt. */
export function tripTimes(trip: Trip, line: Line | undefined): number[] {
  const stops = tripStops(trip, line);
  const out: (number | null)[] = stops.map((s) => trip.times[s.id] ?? null);
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) {
      const prev = out.slice(0, i).reverse().find((x) => x != null);
      out[i] = prev != null ? prev + 3 : null;
    }
  }
  for (let i = out.length - 1; i >= 0; i--) if (out[i] == null) out[i] = (out[i + 1] ?? 480) - 3;
  return out as number[];
}

/** Ankunftszeiten in Fahrtrichtung; ohne eigene Ankunft gilt die Abfahrtszeit. */
export function tripArrivals(trip: Trip, line: Line | undefined): number[] {
  const dep = tripTimes(trip, line);
  return tripStops(trip, line).map((s, i) => trip.arrivals?.[s.id] ?? dep[i]);
}

export function tripLabel(trip: Trip, line: Line | undefined): string {
  const stops = tripStops(trip, line);
  const t = tripTimes(trip, line);
  return `${trip.number ? `Kurs ${trip.number} · ` : ''}${line?.name ?? '?'} ${hm(t[0])} → ${stops.at(-1)?.name ?? ''}`;
}

export interface ResolvedItem extends DutyItem {
  /** Start und Ende in Minuten. */
  s: number;
  e: number;
  trip: Trip | null;
  line: Line | null;
}

export function resolveItems(duty: Duty, trips: Trip[], lines: Line[]): ResolvedItem[] {
  return duty.items
    .map((it) => {
      let s = parseHm(it.start);
      let e = parseHm(it.end);
      let trip: Trip | null = null;
      let line: Line | null = null;
      if (it.type === 'fahrt' && it.tripId) {
        trip = trips.find((t) => t.id === it.tripId) ?? null;
        line = trip ? lines.find((l) => l.id === trip!.lineId) ?? null : null;
        if (trip && line) {
          s = tripTimes(trip, line)[0];
          e = tripArrivals(trip, line).at(-1) ?? s;
        }
      }
      return { ...it, s: s ?? 0, e: e ?? s ?? 0, trip, line };
    })
    .sort((a, b) => a.s - b.s);
}

export function itemTitle(it: ResolvedItem): string {
  if (it.type === 'fahrt' && it.trip && it.line) {
    return `${it.line.name} → ${tripStops(it.trip, it.line).at(-1)?.name ?? ''}`;
  }
  return DUTY_TYPES[it.type];
}

/** IDs von Tätigkeiten, die sich zeitlich überschneiden. */
export function overlappingItems(items: ResolvedItem[]): Set<string> {
  const bad = new Set<string>();
  for (let i = 1; i < items.length; i++) {
    if (items[i].s < items[i - 1].e) {
      bad.add(items[i].id);
      bad.add(items[i - 1].id);
    }
  }
  return bad;
}
