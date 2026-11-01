import { useState } from 'react';
import { db, uid } from '../../data/db';
import { useCalendars, useDutiesAll, useLines, useTrips } from '../../data/hooks';
import { nextCourseNumber } from '../../domain/calendar';
import { tripArrivals, tripStops, tripTimes } from '../../domain/schedule';
import { hm, parseHm } from '../../domain/time';
import type { Direction, Line, ServiceCalendar, Trip } from '../../domain/types';
import { toast } from '../../ui/toast';
import { CalendarPanel } from './CalendarPanel';

/** Modul b: Fahrpläne (Kurse) pro Linie und Richtung, mit Fahrtag-Intervallen. */
export function TimetableEditor() {
  const lines = useLines();
  const trips = useTrips();
  const duties = useDutiesAll();
  const calendars = useCalendars();
  const [lineId, setLineId] = useState<string | null>(null);
  const line = lines.find((l) => l.id === lineId) ?? lines[0];

  return (
    <div className="stack">
      <CalendarPanel />
      {!line ? <p className="empty">Zuerst unter «Linien» eine Linie anlegen.</p> : (
        <>
          <label className="f" style={{ maxWidth: 420 }}>
            Linie
            <select value={line.id} onChange={(e) => setLineId(e.target.value)}>
              {lines.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.route}</option>)}
            </select>
          </label>
          <p className="note">
            Jede Zeile ist ein Kurs. «Kopieren» erstellt einen Kurs mit gleichen Zeiten und gleichem Intervall; ändert man danach die Abfahrt an der
            ersten Haltestelle, verschieben sich alle folgenden Zeiten mit. Diese lassen sich danach einzeln überschreiben. Die Rückrichtung nutzt
            dieselben Haltestellen in umgekehrter Reihenfolge; eine Pause am Wendepunkt gehört in den Dienstplan.
          </p>
          {(['H', 'R'] as Direction[]).map((dir) => (
            <DirectionTable
              key={line.id + dir} line={line} dir={dir} calendars={calendars}
              trips={trips.filter((t) => t.lineId === line.id && t.dir === dir)}
              lineNumbers={trips.filter((t) => t.lineId === line.id).map((t) => t.number)}
              usedIds={new Set(duties.flatMap((d) => d.items.map((i) => i.tripId ?? '')))}
            />
          ))}
        </>
      )}
    </div>
  );
}

/** Abfahrt an der ersten Haltestelle ändern: alle folgenden Zeiten um dieselbe Differenz verschieben. */
export function shiftTrip(t: Trip, line: Line, newStart: number): Pick<Trip, 'times' | 'arrivals'> {
  const delta = newStart - tripTimes(t, line)[0];
  const times: Record<string, number> = {};
  tripStops(t, line).forEach((s, i) => (times[s.id] = tripTimes(t, line)[i] + delta));
  const arrivals = t.arrivals ? Object.fromEntries(Object.entries(t.arrivals).map(([k, v]) => [k, v + delta])) : undefined;
  return arrivals ? { times, arrivals } : { times };
}

function DirectionTable({ line, dir, trips, usedIds, calendars, lineNumbers }: {
  line: Line; dir: Direction; trips: Trip[]; usedIds: Set<string>; calendars: ServiceCalendar[]; lineNumbers: (string | undefined)[];
}) {
  const [takt, setTakt] = useState(60);
  const [fresh, setFresh] = useState<string | null>(null);
  const [delArm, setDelArm] = useState<string | null>(null);
  const [showArr, setShowArr] = useState(trips.some((t) => t.arrivals && Object.keys(t.arrivals).length > 0));
  const stops = dir === 'H' ? line.stops : [...line.stops].reverse();
  const sorted = [...trips].sort((a, b) => tripTimes(a, line)[0] - tripTimes(b, line)[0] || Number(a.number) - Number(b.number));

  const setArrival = (t: Trip, stopId: string, depMin: number, value: string) => {
    const v = parseHm(value);
    const arrivals = { ...(t.arrivals ?? {}) };
    if (v == null || v === depMin) delete arrivals[stopId];
    else arrivals[stopId] = v;
    void db.trips.update(t.id, { arrivals });
  };
  const setDeparture = (t: Trip, i: number, value: string) => {
    const v = parseHm(value);
    if (v == null || v === tripTimes(t, line)[i]) return;
    if (i === 0) void db.trips.update(t.id, shiftTrip(t, line, v));
    else void db.trips.update(t.id, { times: { ...t.times, [stops[i].id]: v } });
  };
  const create = async (src: Trip | null, offset: number) => {
    let trip: Trip;
    if (src) {
      trip = {
        id: uid('T'), lineId: line.id, dir, calendarId: src.calendarId ?? null,
        number: nextCourseNumber(src.number, lineNumbers), ...shiftTrip(src, line, tripTimes(src, line)[0] + offset),
      };
    } else {
      const times: Record<string, number> = {};
      stops.forEach((s, i) => (times[s.id] = 420 + i * 5));
      trip = { id: uid('T'), lineId: line.id, dir, times, number: dir === 'H' ? '1' : '2', calendarId: null };
    }
    await db.trips.add(trip);
    setFresh(trip.id);
    toast(trip.number ? `Kurs ${trip.number} erstellt` : 'Kurs erstellt');
  };
  const add = () => {
    if (!stops.length) return toast('Die Linie hat noch keine Haltestellen');
    void create(sorted.at(-1) ?? null, takt);
  };
  const remove = async (t: Trip) => {
    if (usedIds.has(t.id)) return toast('Dieser Kurs ist in einem Dienst eingeplant. Zuerst dort entfernen.');
    if (delArm !== t.id) {
      setDelArm(t.id);
      setTimeout(() => setDelArm((x) => (x === t.id ? null : x)), 4000);
      return;
    }
    await db.trips.delete(t.id);
    setDelArm(null);
  };

  return (
    <section className="panel">
      <div className="row spread">
        <h2 className="sec m0">Richtung {stops.at(-1)?.name ?? ''}</h2>
        <div className="row">
          <label className="check"><input type="checkbox" checked={showArr} onChange={(e) => setShowArr(e.target.checked)} /> Ankunftszeiten</label>
          <label className="f">Takt (Min.)<input type="number" min={5} className="w-num" value={takt} onChange={(e) => setTakt(Number(e.target.value) || 60)} /></label>
          <button className="btn pri" onClick={add}>+ Kurs</button>
        </div>
      </div>
      {sorted.length ? (
        <div className="tbl" style={{ marginTop: 10 }}>
          <table className="tt">
            <thead>
              <tr><th>Kurs</th><th>Intervall</th>{stops.map((s) => <th key={s.id}>{s.name}</th>)}<th /></tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const tt = tripTimes(t, line);
                const aa = tripArrivals(t, line);
                return (
                  <tr key={t.id} className={fresh === t.id ? 'fresh' : ''}>
                    <td>
                      <input type="text" className="w-kurs" aria-label="Kursnummer" defaultValue={t.number ?? ''} key={t.id + (t.number ?? '')}
                        onBlur={(e) => e.target.value !== (t.number ?? '') && db.trips.update(t.id, { number: e.target.value.trim() })} />
                    </td>
                    <td>
                      <select aria-label="Fahrtag-Intervall" value={t.calendarId ?? ''} onChange={(e) => db.trips.update(t.id, { calendarId: e.target.value || null })}>
                        <option value="">täglich</option>
                        {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    {stops.map((s, i) => (
                      <td key={s.id}>
                        {showArr && i > 0 && i < stops.length - 1 && (
                          <div className="ttcell">
                            <span>an</span>
                            <input type="time" aria-label={`Ankunft ${s.name}`} defaultValue={hm(aa[i])} key={t.id + s.id + 'a' + aa[i]} onBlur={(e) => setArrival(t, s.id, tt[i], e.target.value)} />
                          </div>
                        )}
                        <div className="ttcell">
                          {showArr && <span>{i === stops.length - 1 ? 'an' : 'ab'}</span>}
                          <input type="time" aria-label={`Abfahrt ${s.name}`} defaultValue={hm(tt[i])} key={t.id + s.id + tt[i]} onBlur={(e) => setDeparture(t, i, e.target.value)} />
                        </div>
                      </td>
                    ))}
                    <td className="nowrap">
                      <button className="btn sm" onClick={() => create(t, 0)} title="Kurs mit gleichen Zeiten und gleichem Intervall kopieren">Kopieren</button>{' '}
                      <button className={`btn sm${delArm === t.id ? ' danger' : ''}`} onClick={() => remove(t)} aria-label="Kurs löschen">{delArm === t.id ? 'Löschen?' : '✕'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="empty" style={{ marginTop: 10 }}>Noch keine Kurse. «+ Kurs» legt den ersten an.</p>}
    </section>
  );
}
