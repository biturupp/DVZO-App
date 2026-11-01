/** Kernmodell der DVZO-App. Zeiten sind Minuten ab Mitternacht, Daten ISO-Datum (YYYY-MM-DD). */

export type Role = 'admin' | 'fahrer';

export interface User {
  id: string;
  name: string;
  role: Role;
  /** Nur für den lokalen Testbetrieb. Im Serverbetrieb übernimmt die Anmeldung der Server. */
  pin: string;
}

export interface Vehicle {
  id: string;
  name: string;
  seats?: number;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Radius in Metern, in dem das Fahrzeug als «an der Haltestelle» gilt. Standard 200 m. */
  radius: number;
}

export interface Line {
  id: string;
  name: string;
  route: string;
  color: string;
  /** Gültigkeit des Fahrplans, z. B. «Mo–Fr» oder «So, Mai–Okt». */
  days: string;
  /** Haltestellen in Hinrichtung. Die Rückrichtung ist die umgekehrte Reihenfolge. */
  stops: Stop[];
}

export type Direction = 'H' | 'R';

/** Ein Kurs (eine Fahrt) gemäss Fahrplan. */
export interface Trip {
  id: string;
  lineId: string;
  dir: Direction;
  /** Abfahrtszeit pro Haltestelle (Stop-ID → Minuten ab Mitternacht). */
  times: Record<string, number>;
  /** Ankunftszeit, nur wo sie von der Abfahrt abweicht (z. B. Aufenthalt oder Wendezeit). */
  arrivals?: Record<string, number>;
  /** Kursnummer, frei wählbar (z. B. «3»). */
  number?: string;
  /** Fahrtag-Intervall; ohne Angabe verkehrt der Kurs täglich. */
  calendarId?: string | null;
}

/** Wie allgemeine Feiertage behandelt werden. */
export type HolidayRule = 'normal' | 'sunday' | 'never' | 'only';

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Fahrtag-Intervall: eine benannte Vorlage, die festlegt, an welchen Tagen ein Kurs verkehrt.
 * Beispiel «Sonntage Mai–Okt. ohne Sommerferien»: Zeitraum 1.5.–31.10., Wochentag So, Ausnahme 1.7.–31.8.
 */
export interface ServiceCalendar {
  id: string;
  name: string;
  /** Gültigkeitszeitraum (ISO-Datum, inklusiv). */
  from: string;
  to: string;
  /** Wochentage 1 = Montag … 7 = Sonntag. */
  weekdays: number[];
  holidays: HolidayRule;
  /** Zusätzliche Fahrtage (auch ausserhalb von Zeitraum/Wochentagen). */
  extraDates: string[];
  /** Ausgenommene Zeiträume (einzelner Tag: from = to). */
  exceptions: DateRange[];
}

export const DUTY_TYPES = {
  anfahrt: 'Anfahrt zum Linienstart',
  fahrt: 'Linienfahrt',
  pause: 'Pause',
  wechsel: 'Wechsel auf andere Linie',
  tanken: 'Tanken',
  putzen: 'Putzen',
  rueckfahrt: 'Rückfahrt ins Depot',
} as const;

export type DutyType = keyof typeof DUTY_TYPES;

export interface DutyItem {
  id: string;
  type: DutyType;
  /** «HH:MM»; bei Linienfahrten aus dem Kurs abgeleitet. */
  start: string | null;
  end: string | null;
  note: string;
  tripId: string | null;
}

/** Dienst: ein Fahrer, ein Fahrzeug, ein Tag, eine Liste von Tätigkeiten. */
export interface Duty {
  id: string;
  date: string;
  driverId: string;
  vehicleId: string;
  items: DutyItem[];
  sample?: boolean;
}

/** Eine Zählung an einer Haltestelle auf einem Kurs. */
export interface CountRecord {
  id: string;
  date: string;
  dutyId: string;
  tripId: string;
  lineId: string;
  stopId: string;
  stopName: string;
  /** Position der Haltestelle in Fahrtrichtung (0 = Start). */
  idx: number;
  adultsIn: number;
  adultsOut: number;
  kidsIn: number;
  kidsOut: number;
  /** Erfassungszeit in Minuten ab Mitternacht. */
  time: number;
  /** Fahrplanlage in Minuten (+ = verspätet, − = zu früh), falls bekannt. */
  delay: number | null;
  userId: string;
  vehicleId: string;
  /** true, wenn mit «Fahrzeug leeren» erzeugt. */
  emptied: boolean;
  sample?: boolean;
}

export interface Settings {
  id: 'settings';
  remindMinutes: number;
}
