import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { fetchCountsRange } from '../../data/sync';
import { useAuth } from '../../auth/AuthContext';
import { db } from '../../data/db';
import { today, useLines, useTrips, useUsers, useVehicles } from '../../data/hooks';
import { tripLabel } from '../../domain/schedule';
import { hm, isoDate, signedMinSec } from '../../domain/time';
import type { CountRecord } from '../../domain/types';
import { toast } from '../../ui/toast';

const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); };

/** Auswertung: gespeicherte Zählungen nach Linie und Zeitraum auswählen. */
export function Reports() {
  const { user } = useAuth();
  const lines = useLines();
  const trips = useTrips();
  const users = useUsers();
  const vehicles = useVehicles();
  const [lineId, setLineId] = useState('');
  const [from, setFrom] = useState(yesterday());
  const [to, setTo] = useState(today());
  useEffect(() => { void fetchCountsRange(from, to); }, [from, to]);
  const recs = useLiveQuery(
    () => db.counts.where('date').between(from, to, true, true)
      .filter((c) => (!lineId || c.lineId === lineId) && (user?.role === 'admin' || c.userId === user?.id)).toArray(),
    [from, to, lineId, user?.id], [] as CountRecord[],
  );
  const sum = (k: keyof Pick<CountRecord, 'adultsIn' | 'kidsIn'>) => recs.reduce((a, c) => a + c[k], 0);

  const byStop = new Map<string, { line: string; name: string; ai: number; ki: number; ao: number; ko: number }>();
  recs.forEach((c) => {
    const k = c.lineId + '|' + c.stopName;
    const e = byStop.get(k) ?? { line: c.lineId, name: c.stopName, ai: 0, ki: 0, ao: 0, ko: 0 };
    e.ai += c.adultsIn; e.ki += c.kidsIn; e.ao += c.adultsOut; e.ko += c.kidsOut;
    byStop.set(k, e);
  });
  const byTrip = new Map<string, CountRecord[]>();
  recs.forEach((c) => { const k = `${c.date}|${c.tripId}|${c.dutyId}`; byTrip.set(k, [...(byTrip.get(k) ?? []), c]); });
  const tripRows = [...byTrip.values()].map((rs) => {
    rs.sort((a, b) => a.idx - b.idx || a.time - b.time);
    let o = 0, max = 0;
    rs.forEach((r) => { o += r.adultsIn + r.kidsIn - r.adultsOut - r.kidsOut; max = Math.max(max, o); });
    const ds = rs.map((r) => r.delay).filter((x): x is number => x != null);
    return { r: rs[0], max, rest: o, boarded: rs.reduce((a, r) => a + r.adultsIn + r.kidsIn, 0), avg: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null };
  }).sort((a, b) => (a.r.date < b.r.date ? 1 : -1));

  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? id;
  const copyCsv = async () => {
    const head = 'Datum;Linie;Kurs;Haltestelle;Zeit;Ein Erwachsene;Ein Kinder;Aus Erwachsene;Aus Kinder;Lage Min;Fahrer;Fahrzeug;Geleert';
    const rows = recs.map((c) => [c.date, lineName(c.lineId), c.tripId, c.stopName, hm(c.time), c.adultsIn, c.kidsIn, c.adultsOut, c.kidsOut, c.delay ?? '',
      users.find((u) => u.id === c.userId)?.name ?? '', vehicles.find((v) => v.id === c.vehicleId)?.name ?? '', c.emptied ? 'ja' : ''].join(';'));
    try { await navigator.clipboard.writeText([head, ...rows].join('\n')); toast('CSV in die Zwischenablage kopiert'); } catch { toast('Kopieren nicht möglich'); }
  };

  return (
    <div className="stack">
      <div className="row">
        <label className="f">Linie
          <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
            <option value="">Alle Linien</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="f">Von<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="f">Bis<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn" disabled={!recs.length} onClick={copyCsv}>Als CSV kopieren</button>
        {recs.some((r) => r.sample) && <span className="chip sim">enthält Beispieldaten</span>}
      </div>
      <div className="tiles">
        <div className="tile"><b>{sum('adultsIn') + sum('kidsIn')}</b><span>Einsteigende total</span></div>
        <div className="tile"><b>{sum('adultsIn')}</b><span>davon Erwachsene</span></div>
        <div className="tile"><b>{sum('kidsIn')}</b><span>davon Kinder</span></div>
        <div className="tile"><b>{tripRows.length}</b><span>gezählte Kurse</span></div>
      </div>
      {recs.length ? (
        <>
          <section className="panel">
            <h2 className="sec">Nach Haltestelle</h2>
            <div className="tbl"><table>
              <thead><tr><th>Linie</th><th>Haltestelle</th><th className="num">Ein Erw.</th><th className="num">Ein Kinder</th><th className="num">Aus Erw.</th><th className="num">Aus Kinder</th></tr></thead>
              <tbody>{[...byStop.values()].map((s) => (
                <tr key={s.line + s.name}><td>{lineName(s.line)}</td><td>{s.name}</td><td className="num">{s.ai}</td><td className="num">{s.ki}</td><td className="num">{s.ao}</td><td className="num">{s.ko}</td></tr>
              ))}</tbody>
            </table></div>
          </section>
          <section className="panel">
            <h2 className="sec">Nach Kurs</h2>
            <div className="tbl"><table>
              <thead><tr><th>Datum</th><th>Kurs</th><th>Fahrer/in</th><th>Fahrzeug</th><th className="num">Einsteigende</th><th className="num">Max. besetzt</th><th className="num">Ø Lage</th></tr></thead>
              <tbody>{tripRows.map(({ r, max, rest, boarded, avg }) => {
                const t = trips.find((x) => x.id === r.tripId);
                return (
                  <tr key={r.date + r.tripId + r.dutyId}>
                    <td className="mono">{r.date.split('-').reverse().join('.')}</td>
                    <td>{t ? tripLabel(t, lines.find((l) => l.id === t.lineId)) : r.tripId}{rest > 0 && <> <span className="chip warn">nicht geleert</span></>}</td>
                    <td>{users.find((u) => u.id === r.userId)?.name}</td>
                    <td>{vehicles.find((v) => v.id === r.vehicleId)?.name}</td>
                    <td className="num">{boarded}</td><td className="num">{max}</td><td className="num">{avg == null ? '–' : signedMinSec(avg)}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </section>
        </>
      ) : <p className="empty">Für diese Auswahl gibt es keine Zählungen. Passe Linie oder Zeitraum an.</p>}
    </div>
  );
}
