const pad2 = (n: number) => String(n).padStart(2, '0');

/** Minuten ab Mitternacht → «HH:MM». */
export function hm(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min)) return '–';
  let m = Math.round(min);
  m = ((m % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** «HH:MM» → Minuten ab Mitternacht. */
export function parseHm(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Dauer in Minuten → «m:ss» (ohne Vorzeichen). */
export function minSec(v: number): string {
  const s = Math.round(Math.abs(v) * 60);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** Abweichung in Minuten → «+1:30», «−0:45» oder «±0:00». */
export function signedMinSec(v: number): string {
  const sign = v > 0.008 ? '+' : v < -0.008 ? '−' : '±';
  return sign + minSec(v);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Freie Zeiteingabe in «HH:MM» (24 Stunden) umwandeln.
 * Akzeptiert z. B. «8:30», «8.30», «0830», «830», «8» und «24:00» nicht. Ungültig → null.
 */
export function normalizeTime(input: string): string | null {
  const s = input.trim().replace(/[.,h ]/g, ':');
  if (!s) return null;
  let h: number;
  let m: number;
  const colon = /^(\d{1,2}):(\d{1,2})?$/.exec(s);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2] ?? 0);
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) { h = Number(s); m = 0; }
    else { h = Number(s.slice(0, s.length - 2)); m = Number(s.slice(-2)); }
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

/** ISO «JJJJ-MM-TT» → «TT.MM.JJJJ». */
export function fmtDate(iso: string): string {
  return iso ? iso.split('-').reverse().join('.') : '';
}

/**
 * Freie Datumseingabe (Schweizer Schreibweise) in ISO «JJJJ-MM-TT» umwandeln.
 * Akzeptiert «1.5.2027», «01.05.27», «1.5.» und «1.5» (Jahr aus `refYear`). Ungültig → null.
 */
export function parseDate(input: string, refYear = new Date().getFullYear()): string | null {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validIso(s);
  const m = /^(\d{1,2})[./ -](\d{1,2})(?:[./ -](\d{2}|\d{4})?)?\.?$/.exec(s);
  if (!m) return null;
  let y = m[3] ? Number(m[3]) : refYear;
  if (m[3] && m[3].length === 2) y += 2000;
  return validIso(`${y}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`);
}

function validIso(iso: string): string | null {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? iso : null;
}

/** true, wenn das Datum (ISO) mehr als `months` Monate vor `today` (ISO) liegt. */
export function olderThanMonths(iso: string | undefined, months: number, today: string): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const limit = new Date(y, m - 1 + months, d);
  // Monatsende: 31.03. + 1 Monat = 30.04., nicht 01.05.
  if (limit.getDate() !== d) limit.setDate(0);
  return isoDate(limit) < today;
}
