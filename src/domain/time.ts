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
