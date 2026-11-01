import { isoDate } from './time';
import type { ServiceCalendar } from './types';

const pad2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Ostersonntag (gregorianisch, Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const shift = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

/** Allgemeine Feiertage im Kanton Zürich (Datum → Name). */
export function holidays(year: number): Map<string, string> {
  const e = easterSunday(year);
  return new Map([
    [iso(year, 1, 1), 'Neujahr'],
    [iso(year, 1, 2), 'Berchtoldstag'],
    [isoDate(shift(e, -2)), 'Karfreitag'],
    [isoDate(shift(e, 1)), 'Ostermontag'],
    [iso(year, 5, 1), 'Tag der Arbeit'],
    [isoDate(shift(e, 39)), 'Auffahrt'],
    [isoDate(shift(e, 50)), 'Pfingstmontag'],
    [iso(year, 8, 1), 'Bundesfeier'],
    [iso(year, 12, 25), 'Weihnachten'],
    [iso(year, 12, 26), 'Stephanstag'],
  ]);
}

export function holidayName(date: string): string | undefined {
  return holidays(Number(date.slice(0, 4))).get(date);
}

/** ISO-Wochentag 1 = Montag … 7 = Sonntag. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return w === 0 ? 7 : w;
}

/** Verkehrt ein Kurs mit diesem Intervall am Datum? Ohne Intervall: täglich. */
export function runsOn(cal: ServiceCalendar | null | undefined, date: string): boolean {
  if (!cal) return true;
  if (cal.extraDates.includes(date)) return true;
  if (date < cal.from || date > cal.to) return false;
  if (cal.exceptions.some((r) => date >= r.from && date <= r.to)) return false;
  const holiday = !!holidayName(date);
  switch (cal.holidays) {
    case 'only':
      return holiday;
    case 'never':
      if (holiday) return false;
      break;
    case 'sunday':
      if (holiday) return cal.weekdays.includes(7);
      break;
  }
  return cal.weekdays.includes(weekdayOf(date));
}

/** Alle Fahrtage des Intervalls (für Vorschau und Zählung). */
export function serviceDates(cal: ServiceCalendar): string[] {
  const out: string[] = [];
  const [y, m, d] = cal.from.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  for (let i = 0; i < 800 && isoDate(cur) <= cal.to; i++) {
    const s = isoDate(cur);
    if (runsOn(cal, s)) out.push(s);
    cur.setDate(cur.getDate() + 1);
  }
  for (const x of cal.extraDates) if (!out.includes(x)) out.push(x);
  return out.sort();
}

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAY_LABELS = WD;

/** Kurzbeschreibung, z. B. «So · 01.05.–31.10.2027 · ohne 01.07.–31.08.». */
export function describe(cal: ServiceCalendar): string {
  const fmt = (s: string) => s.split('-').reverse().join('.');
  const short = (s: string) => fmt(s).slice(0, 6);
  const wd = [...cal.weekdays].sort();
  let days: string;
  if (wd.length === 7) days = 'täglich';
  else if (wd.join() === '1,2,3,4,5') days = 'Mo–Fr';
  else if (wd.join() === '6,7') days = 'Sa, So';
  else days = wd.map((w) => WD[w - 1]).join(', ');
  const parts = [days, `${short(cal.from)}–${fmt(cal.to)}`];
  if (cal.holidays === 'sunday') parts.push('Feiertage wie Sonntag');
  if (cal.holidays === 'never') parts.push('nicht an Feiertagen');
  if (cal.holidays === 'only') parts.push('nur an Feiertagen');
  if (cal.exceptions.length) parts.push('ohne ' + cal.exceptions.map((r) => (r.from === r.to ? short(r.from) : `${short(r.from)}–${short(r.to)}`)).join(', '));
  if (cal.extraDates.length) parts.push('zusätzlich ' + cal.extraDates.map(short).join(', '));
  return parts.join(' · ');
}

/** Nächste Kursnummer beim Kopieren: gleiche Parität (Schweizer Praxis: eine Richtung ungerade, die andere gerade). */
export function nextCourseNumber(current: string | undefined, existing: (string | undefined)[]): string {
  const n = Number(current);
  if (!current || Number.isNaN(n)) return '';
  const used = new Set(existing.filter(Boolean));
  let next = n + 2;
  while (used.has(String(next))) next += 2;
  return String(next);
}
