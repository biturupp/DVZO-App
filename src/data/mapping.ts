import type { CountRecord, Duty, Line, ServiceCalendar, Trip, User, Vehicle } from '../domain/types';
import type { SyncTable } from './db';

/** Umrechnung zwischen App-Datensätzen (camelCase) und Server-Zeilen (snake_case). */
type Row = Record<string, unknown>;

export const toRow: Record<SyncTable, (o: any) => Row> = {
  lines: (l: Line) => ({ id: l.id, name: l.name, route: l.route, color: l.color, days: l.days, stops: l.stops, updated_at: new Date().toISOString() }),
  // `arrivals` nur senden, wenn genutzt (Spalte kommt mit Migration 20261101200000)
  calendars: (c: ServiceCalendar) => ({
    id: c.id, name: c.name, date_from: c.from, date_to: c.to, weekdays: c.weekdays, holidays: c.holidays,
    extra_dates: c.extraDates, exceptions: c.exceptions, updated_at: new Date().toISOString(),
  }),
  trips: (t: Trip) => ({
    id: t.id, line_id: t.lineId, dir: t.dir, times: t.times, arrivals: t.arrivals ?? {},
    number: t.number ?? '', calendar_id: t.calendarId ?? null, updated_at: new Date().toISOString(),
  }),
  vehicles: (v: Vehicle) => ({ id: v.id, name: v.name, seats: v.seats ?? null }),
  duties: (d: Duty) => ({ id: d.id, date: d.date, driver_id: d.driverId, vehicle_id: d.vehicleId || null, items: d.items, updated_at: new Date().toISOString() }),
  counts: (c: CountRecord) => ({
    id: c.id, date: c.date, duty_id: c.dutyId, trip_id: c.tripId, line_id: c.lineId, stop_id: c.stopId, stop_name: c.stopName, idx: c.idx,
    adults_in: c.adultsIn, adults_out: c.adultsOut, kids_in: c.kidsIn, kids_out: c.kidsOut, time: c.time, delay: c.delay,
    user_id: c.userId, vehicle_id: c.vehicleId || null, emptied: c.emptied,
  }),
};

export const fromRow: Record<SyncTable, (r: any) => unknown> = {
  lines: (r): Line => ({ id: r.id, name: r.name, route: r.route, color: r.color, days: r.days, stops: r.stops ?? [] }),
  calendars: (r): ServiceCalendar => ({
    id: r.id, name: r.name, from: r.date_from, to: r.date_to, weekdays: r.weekdays ?? [], holidays: r.holidays ?? 'normal',
    extraDates: r.extra_dates ?? [], exceptions: r.exceptions ?? [],
  }),
  trips: (r): Trip => ({
    id: r.id, lineId: r.line_id, dir: r.dir, times: r.times ?? {},
    ...(r.arrivals && Object.keys(r.arrivals).length ? { arrivals: r.arrivals } : {}),
    ...(r.number ? { number: r.number } : {}), calendarId: r.calendar_id ?? null,
  }),
  vehicles: (r): Vehicle => ({ id: r.id, name: r.name, seats: r.seats ?? undefined }),
  duties: (r): Duty => ({ id: r.id, date: r.date, driverId: r.driver_id, vehicleId: r.vehicle_id ?? '', items: r.items ?? [] }),
  counts: (r): CountRecord => ({
    id: r.id, date: r.date, dutyId: r.duty_id, tripId: r.trip_id, lineId: r.line_id, stopId: r.stop_id, stopName: r.stop_name, idx: r.idx,
    adultsIn: r.adults_in, adultsOut: r.adults_out, kidsIn: r.kids_in, kidsOut: r.kids_out, time: Number(r.time),
    delay: r.delay == null ? null : Number(r.delay), userId: r.user_id, vehicleId: r.vehicle_id ?? '', emptied: r.emptied,
  }),
};

export const profileToUser = (r: { id: string; name: string; role: 'admin' | 'fahrer' }): User => ({ id: r.id, name: r.name, role: r.role, pin: '' });
