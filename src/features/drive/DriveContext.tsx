import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { db, uid } from '../../data/db';
import { today, useCountsOn, useDutiesOn, useLines, useSettings, useTrips, useUsers, useVehicles } from '../../data/hooks';
import {
  computeLage, currentAndNext, dueReminder, lageForRecord, occupancy, pickActiveTrip, simulatePosition, stopInRadius,
  type Lage, type Occupancy, type Reminder,
} from '../../domain/drive';
import type { LatLon } from '../../domain/geo';
import { itemTitle, resolveItems, tripArrivals, tripStops, tripTimes, type ResolvedItem } from '../../domain/schedule';
import { canDispose, type CountRecord, type Duty, type Line, type Stop, type User, type Vehicle } from '../../domain/types';
import { beep } from '../../ui/sound';
import { toast } from '../../ui/toast';
import { useSim } from './SimContext';

export type CountForm = { adultsIn: number; adultsOut: number; kidsIn: number; kidsOut: number };
export const EMPTY_FORM: CountForm = { adultsIn: 0, adultsOut: 0, kidsIn: 0, kidsOut: 0 };

/**
 * Laufzustand der Fahrt (Dienst, aktive Linienfahrt, Position, Fahrplanlage, offene Zählung).
 * Liegt über allen Ansichten, damit Dashboard und Zählung denselben Stand zeigen
 * und beim Wechsel zwischen den Ansichten nichts verloren geht.
 */
export interface DriveState {
  date: string;
  now: number;
  duties: Duty[];
  duty: Duty | undefined;
  pickDuty: (id: string) => void;
  users: User[];
  vehicles: Vehicle[];
  lines: Line[];
  items: ResolvedItem[];
  current: ResolvedItem | null;
  next: ResolvedItem | null;
  active: ResolvedItem | null;
  stops: Stop[];
  times: number[];
  arrivals: number[];
  position: LatLon | null;
  atIdx: number;
  effLastIdx: number;
  lage: Lage | null;
  occ: Occupancy;
  tripRecs: CountRecord[];
  reminder: Reminder | null;
  selIdx: number | null;
  selAuto: boolean;
  selectStop: (idx: number | null) => void;
  form: CountForm;
  setForm: (f: CountForm) => void;
  saveRecord: (idx: number, f: CountForm, emptied: boolean, auto?: boolean) => Promise<void>;
}

const Ctx = createContext<DriveState | null>(null);

export function DriveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const date = today();
  const duties = useDutiesOn(date);
  const lines = useLines();
  const trips = useTrips();
  const users = useUsers();
  const vehicles = useVehicles();
  const counts = useCountsOn(date);
  const settings = useSettings();
  const sim = useSim();
  const now = sim.now;

  const [pickedDuty, setPickedDuty] = useState<string | null>(null);
  const duty = canDispose(user) ? duties.find((d) => d.id === pickedDuty) ?? duties[0] : duties.find((d) => d.driverId === user?.id);
  const items = useMemo(() => (duty ? resolveItems(duty, trips, lines) : []), [duty, trips, lines]);
  const { current, next } = currentAndNext(items, now);

  const [tripId, setTripId] = useState<string | null>(null);
  const [lastIdx, setLastIdx] = useState(-1);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [selAuto, setSelAuto] = useState(true);
  const [form, setForm] = useState<CountForm>(EMPTY_FORM);
  const reminded = useRef<string | null>(null);

  const recsOf = (tid: string) => counts.filter((c) => c.tripId === tid && c.dutyId === duty?.id);
  const active = pickActiveTrip(items, now, tripId, (tid) => occupancy(recsOf(tid)));
  const stops = active?.trip && active.line ? tripStops(active.trip, active.line) : [];
  const times = active?.trip && active.line ? tripTimes(active.trip, active.line) : [];
  const arrivals = active?.trip && active.line ? tripArrivals(active.trip, active.line) : [];

  const position = sim.mode === 'sim-auto' ? (active ? simulatePosition(stops, times, now, sim.simDelay, arrivals) : null) : sim.position;
  const atIdx = stopInRadius(stops, position);
  const effLastIdx = Math.max(lastIdx, atIdx);
  const lage: Lage | null = active ? computeLage(stops, times, position, atIdx, effLastIdx, now, arrivals) : null;

  const saveRecord = async (idx: number, f: CountForm, emptied: boolean, auto = false) => {
    if (!duty || !active?.trip) return;
    const s = stops[idx];
    const rec: CountRecord = {
      id: uid('c'), date, dutyId: duty.id, tripId: active.trip.id, lineId: active.trip.lineId, stopId: s.id, stopName: s.name, idx,
      ...f, time: now, delay: lageForRecord(lage), userId: duty.driverId, vehicleId: duty.vehicleId, emptied,
    };
    await db.counts.add(rec);
    setForm(EMPTY_FORM);
    toast(emptied ? `Fahrzeug geleert: ${f.adultsOut} Erwachsene und ${f.kidsOut} Kinder ausgestiegen` : auto ? `Erfassung für ${s.name} automatisch gespeichert` : `${s.name} gespeichert`);
  };
  const dirty = form.adultsIn + form.adultsOut + form.kidsIn + form.kidsOut > 0;

  // Fahrtwechsel
  useEffect(() => {
    const id = active?.tripId ?? null;
    if (id === tripId) return;
    setTripId(id);
    setLastIdx(-1);
    setSelIdx(null);
    setSelAuto(true);
    setForm(EMPTY_FORM);
    // eslint-disable-next-line
  }, [active?.tripId]);

  // Ankunft an einer Haltestelle: automatisch auswählen, offene Erfassung der vorherigen sichern
  useEffect(() => {
    if (atIdx < 0) return;
    if (atIdx > lastIdx) setLastIdx(atIdx);
    if (selAuto || selIdx == null) {
      if (dirty && selIdx != null && selIdx !== atIdx) void saveRecord(selIdx, form, false, true);
      setSelIdx(atIdx);
      setSelAuto(true);
    }
    // eslint-disable-next-line
  }, [atIdx]);

  // Erinnerung vor Abfahrt, egal welche Ansicht offen ist
  const reminder = duty ? dueReminder(active, stops, times, atIdx, effLastIdx, next, next ? itemTitle(next) : '', now, settings?.remindMinutes ?? 3) : null;
  useEffect(() => {
    if (reminder && reminded.current !== reminder.key) {
      reminded.current = reminder.key;
      beep();
    }
  }, [reminder?.key]);

  const selectStop = (idx: number | null) => {
    if (idx == null) { setSelAuto(true); setSelIdx(atIdx >= 0 ? atIdx : null); }
    else { setSelAuto(false); setSelIdx(idx); }
  };

  const occ = active?.tripId ? occupancy(recsOf(active.tripId)) : { adults: 0, kids: 0 };
  const tripRecs = active?.tripId ? recsOf(active.tripId).sort((a, b) => a.time - b.time) : [];

  const value: DriveState = {
    date, now, duties, duty, pickDuty: setPickedDuty, users, vehicles, lines, items, current, next, active, stops, times, arrivals,
    position, atIdx, effLastIdx, lage, occ, tripRecs, reminder, selIdx, selAuto, selectStop, form, setForm, saveRecord,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDrive() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDrive ausserhalb von DriveProvider');
  return c;
}
