import { describe, expect, it } from 'vitest';
import { describe as describeCal, easterSunday, holidayName, nextCourseNumber, runsOn, serviceDates, weekdayOf } from './calendar';
import { isoDate } from './time';
import type { ServiceCalendar } from './types';

const base: ServiceCalendar = { id: 'c', name: 'x', from: '2027-01-01', to: '2027-12-31', weekdays: [1, 2, 3, 4, 5], holidays: 'normal', extraDates: [], exceptions: [] };

describe('Feiertage', () => {
  it('berechnet Ostern und bewegliche Feiertage', () => {
    expect(isoDate(easterSunday(2026))).toBe('2026-04-05');
    expect(isoDate(easterSunday(2027))).toBe('2027-03-28');
    expect(holidayName('2027-05-06')).toBe('Auffahrt');
    expect(holidayName('2027-05-17')).toBe('Pfingstmontag');
    expect(holidayName('2027-08-01')).toBe('Bundesfeier');
  });
  it('kennt die Wochentage', () => {
    expect(weekdayOf('2026-11-01')).toBe(7);
    expect(weekdayOf('2026-11-02')).toBe(1);
  });
});

describe('Fahrtag-Intervall', () => {
  const sommerSonntage: ServiceCalendar = {
    ...base, name: 'Sonntage Mai–Okt. ohne Juli/August', from: '2027-05-01', to: '2027-10-31', weekdays: [7], exceptions: [{ from: '2027-07-01', to: '2027-08-31' }],
  };
  it('Beispiel: sonntags Mai bis Oktober ohne Juli und August', () => {
    expect(runsOn(sommerSonntage, '2027-05-02')).toBe(true);
    expect(runsOn(sommerSonntage, '2027-05-03')).toBe(false); // Montag
    expect(runsOn(sommerSonntage, '2027-07-04')).toBe(false); // Sonntag im Juli
    expect(runsOn(sommerSonntage, '2027-09-05')).toBe(true);
    expect(runsOn(sommerSonntage, '2027-11-07')).toBe(false); // ausserhalb
    expect(serviceDates(sommerSonntage)).toHaveLength(18);
  });
  it('behandelt Feiertage nach Regel', () => {
    // Auffahrt 2027 = Donnerstag 6.5.
    expect(runsOn(base, '2027-05-06')).toBe(true);
    expect(runsOn({ ...base, holidays: 'never' }, '2027-05-06')).toBe(false);
    expect(runsOn({ ...base, holidays: 'sunday' }, '2027-05-06')).toBe(false);
    expect(runsOn({ ...base, weekdays: [7], holidays: 'sunday' }, '2027-05-06')).toBe(true);
    expect(runsOn({ ...base, weekdays: [], holidays: 'only' }, '2027-05-06')).toBe(true);
    expect(runsOn({ ...base, weekdays: [], holidays: 'only' }, '2027-05-07')).toBe(false);
  });
  it('kennt Zusatztage und einzelne Ausnahmetage', () => {
    const c = { ...base, extraDates: ['2027-12-31'], exceptions: [{ from: '2027-03-03', to: '2027-03-03' }] };
    expect(runsOn(c, '2027-03-03')).toBe(false);
    expect(runsOn({ ...c, to: '2027-06-30' }, '2027-12-31')).toBe(true);
    expect(runsOn(null, '2027-03-03')).toBe(true);
  });
  it('beschreibt das Intervall kurz', () => {
    expect(describeCal(sommerSonntage)).toBe('So · 01.05.–31.10.2027 · ohne 01.07.–31.08.');
  });
});

describe('Kursnummer beim Kopieren', () => {
  it('nimmt die nächste freie Nummer gleicher Parität', () => {
    expect(nextCourseNumber('3', ['1', '3'])).toBe('5');
    expect(nextCourseNumber('3', ['3', '5'])).toBe('7');
    expect(nextCourseNumber('', [])).toBe('');
  });
});
