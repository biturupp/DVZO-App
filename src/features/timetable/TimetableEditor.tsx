import { useState } from 'react';
import { db } from '../../data/db';
import { useDutiesAll, useLines, useTrips } from '../../data/hooks';
import { tripTimes } from '../../domain/schedule';
import { hm, parseHm } from '../../domain/time';
import type { Direction, Line, Trip } from '../../domain/types';
import { toast } from '../../ui/toast';

/** Modul b: Fahrpläne (Kurse) pro Linie und Richtung. */
export function TimetableEditor() {
  const lines = useLines();
  const trips = useTrips();
  const duties = useDutiesAll();
  const [lineId, setLineId] = useState<string | null>(null);
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  if (!line) return <p className="empty">Zuerst eine Linie anlegen.</p>;

  return (
    <div className="stack">
      <div className="row">
        <label className="f">
          Linie
          <select value={line.id} onChange={(e) => setLineId(e.target.value)}>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.route}</option>)}
          </select>
        </label>
        <label className="f">
          Gültig an
          <input type="text" key={line.id} defaultValue={line.days} placeholder="Mo–Fr" onBlur={(e) => db.lines.update(line.id, { days: e.target.value })} />
        </label>
      </div>
      <p className="note">Jede Zeile ist ein Kurs. «+ Kurs» kopiert den letzten Kurs, verschoben um den Takt. Die Kurse stehen danach im Dienstplan zur Auswahl.</p>
      {(['H', 'R'] as Direction[]).map((dir) => (
        <DirectionTable key={dir} line={line} dir={dir} trips={trips.filter((t) => t.lineId === line.id && t.dir === dir)} usedIds={new Set(duties.flatMap((d) => d.items.map((i) => i.tripId ?? '')))} />
      ))}
    </div>
  );
}

function DirectionTable({ line, dir, trips, usedIds }: { line: Line; dir: Direction; trips: Trip[]; usedIds: Set<string> }) {
  const [takt, setTakt] = useState(60);
  const stops = dir === 'H' ? line.stops : [...line.stops].reverse();
  const sorted = [...trips].sort((a, b) => tripTimes(a, line)[0] - tripTimes(b, line)[0]);

  const add = async () => {
    if (!stops.length) return toast('Die Linie hat noch keine Haltestellen');
    const base = sorted.length ? tripTimes(sorted[sorted.length - 1], line).map((x) => x + takt) : stops.map((_, i) => 420 + i * 5);
    const times: Record<string, number> = {};
    stops.forEach((s, i) => (times[s.id] = base[i]));
    let id = `${line.id}-${dir}-${hm(base[0]).replace(':', '')}`;
    if (await db.trips.get(id)) id += '-' + Math.random().toString(36).slice(2, 5);
    await db.trips.add({ id, lineId: line.id, dir, times });
  };
  const remove = async (t: Trip) => {
    if (usedIds.has(t.id)) return toast('Dieser Kurs ist in einem Dienst eingeplant. Zuerst dort entfernen.');
    await db.trips.delete(t.id);
  };

  return (
    <section className="panel">
      <div className="row spread">
        <h2 className="sec m0">Richtung {stops.at(-1)?.name ?? ''}</h2>
        <div className="row">
          <label className="f">Takt (Min.)<input type="number" min={5} className="w-num" value={takt} onChange={(e) => setTakt(Number(e.target.value) || 60)} /></label>
          <button className="btn pri" onClick={add}>+ Kurs</button>
        </div>
      </div>
      {sorted.length ? (
        <div className="tbl" style={{ marginTop: 10 }}>
          <table>
            <thead><tr>{stops.map((s) => <th key={s.id}>{s.name}</th>)}<th /></tr></thead>
            <tbody>
              {sorted.map((t) => {
                const tt = tripTimes(t, line);
                return (
                  <tr key={t.id}>
                    {stops.map((s, i) => (
                      <td key={s.id}>
                        <input
                          type="time" defaultValue={hm(tt[i])} key={t.id + s.id + tt[i]}
                          onBlur={(e) => { const v = parseHm(e.target.value); if (v != null) db.trips.update(t.id, { times: { ...t.times, [s.id]: v } }); }}
                        />
                      </td>
                    ))}
                    <td><button className="btn sm" onClick={() => remove(t)} aria-label="Kurs löschen">✕</button></td>
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
