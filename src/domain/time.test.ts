import { describe, expect, it } from 'vitest';
import { normalizeTime } from './time';

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
