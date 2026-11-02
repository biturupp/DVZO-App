import { describe, expect, it } from 'vitest';
import { fmtDate, normalizeTime, olderThanMonths, parseDate } from './time';

describe('Zeiteingabe 24 Stunden', () => {
  it('versteht verschiedene Schreibweisen', () => {
    expect(normalizeTime('8:30')).toBe('08:30');
    expect(normalizeTime('8.30')).toBe('08:30');
    expect(normalizeTime('0830')).toBe('08:30');
    expect(normalizeTime('830')).toBe('08:30');
    expect(normalizeTime('17')).toBe('17:00');
    expect(normalizeTime('23:59')).toBe('23:59');
    expect(normalizeTime('0:05')).toBe('00:05');
  });
  it('lehnt Ungültiges ab', () => {
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime('12:60')).toBeNull();
    expect(normalizeTime('8 Uhr')).toBeNull();
    expect(normalizeTime('')).toBeNull();
  });
});

describe('parseDate', () => {
  it('liest Schweizer Schreibweise', () => {
    expect(parseDate('1.5.2027')).toBe('2027-05-01');
    expect(parseDate('01.05.27')).toBe('2027-05-01');
    expect(parseDate('1.5.', 2028)).toBe('2028-05-01');
    expect(parseDate('31.12', 2026)).toBe('2026-12-31');
    expect(parseDate('2027-05-01')).toBe('2027-05-01');
  });
  it('lehnt ungültige Daten ab', () => {
    expect(parseDate('31.4.2027')).toBeNull();
    expect(parseDate('29.2.2027')).toBeNull();
    expect(parseDate('abc')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
  it('formatiert TT.MM.JJJJ', () => {
    expect(fmtDate('2027-05-01')).toBe('01.05.2027');
  });
});

describe('olderThanMonths', () => {
  it('erkennt abgelaufene Prüfungen nach 12 Monaten', () => {
    expect(olderThanMonths('2025-11-02', 12, '2026-11-02')).toBe(false);
    expect(olderThanMonths('2025-11-01', 12, '2026-11-02')).toBe(true);
    expect(olderThanMonths('2026-03-15', 12, '2026-11-02')).toBe(false);
    expect(olderThanMonths('2024-02-29', 12, '2025-02-28')).toBe(false);
    expect(olderThanMonths('2024-02-29', 12, '2025-03-01')).toBe(true);
    expect(olderThanMonths('', 12, '2026-11-02')).toBe(false);
  });
});
