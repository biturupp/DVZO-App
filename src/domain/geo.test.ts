import { describe, expect, it } from 'vitest';
import { distanceM, lv95ToWgs84, parseCoordinates } from './geo';

describe('geo', () => {
  it('misst Distanzen in Metern', () => {
    // 0.0018° Breite ≈ 200 m
    expect(distanceM({ lat: 47.38, lon: 8.97 }, { lat: 47.3818, lon: 8.97 })).toBeCloseTo(200, -1);
  });

  it('rechnet LV95 in WGS84 um (Referenzpunkt Bern)', () => {
    const p = lv95ToWgs84(2600000, 1200000);
    expect(p.lat).toBeCloseTo(46.95108, 3);
    expect(p.lon).toBeCloseTo(7.43864, 3);
  });

  it('erkennt verschiedene Koordinatenformate', () => {
    expect(parseCoordinates('47.3868, 8.9690')).toMatchObject({ lat: 47.3868, lon: 8.969, format: 'WGS84' });
    expect(parseCoordinates('8.9690 47.3868')).toMatchObject({ lat: 47.3868, lon: 8.969 });
    expect(parseCoordinates("2'712'000 1'245'000")?.format).toBe('LV95');
    expect(parseCoordinates('712000 245000')?.format).toBe('LV03');
    expect(parseCoordinates('Hulftegg')).toBeNull();
  });
});
