import { describe, expect, it } from 'vitest';
import { shiftTrip } from './TimetableEditor';
import type { Line, Trip } from '../../domain/types';

const line: Line = {
  id: 'L', name: 'L', route: '', color: '', days: '',
  stops: [{ id: 'a', name: 'Bauma', lat: 0, lon: 0, radius: 200 }, { id: 'b', name: 'B', lat: 0, lon: 0, radius: 200 }, { id: 'c', name: 'C', lat: 0, lon: 0, radius: 200 }],
};

describe('Kurs verschieben', () => {
  it('verschiebt alle Zeiten und Ankünfte, wenn die erste Abfahrt geändert wird', () => {
    const t: Trip = { id: 'k3', lineId: 'L', dir: 'H', number: '3', times: { a: 510, b: 522, c: 540 }, arrivals: { b: 520 } };
    expect(shiftTrip(t, line, 570)).toEqual({ times: { a: 570, b: 582, c: 600 }, arrivals: { b: 580 } });
  });
});
