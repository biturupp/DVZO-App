import { useAuth } from '../../auth/AuthContext';
import { db } from '../../data/db';
import { distanceM, formatDistance } from '../../domain/geo';
import { itemTitle, tripLabel } from '../../domain/schedule';
import { hm, minSec, signedMinSec } from '../../domain/time';
import { canDispose, DUTY_TYPES } from '../../domain/types';
import { MapView } from '../../ui/MapView';
import { toast } from '../../ui/toast';
import { useDrive, type CountForm } from './DriveContext';
import { lageText } from './lageText';
import { useSim } from './SimContext';
import { SimPanel } from './SimPanel';

type Form = CountForm;

export function DriveView() {
  const { user } = useAuth();
  const sim = useSim();
  const {
    now, duties, duty, pickDuty, users, vehicles, lines, items, current, next, active, stops, times, position, atIdx, effLastIdx, lage,
    occ, tripRecs, reminder, selIdx, selAuto, selectStop, form, setForm, saveRecord,
  } = useDrive();

  if (!duty) {
    return (
      <div className="stack">
        <p className="empty">Für heute ist dir kein Dienst zugeteilt.</p>
        <SimPanel firstStart={null} />
      </div>
    );
  }

  const { status, big, label, sub } = lageText(lage, stops, times, effLastIdx, now);
  const sel = selIdx != null ? stops[selIdx] : null;
  const isLast = selIdx === stops.length - 1;

  const step = (k: keyof Form, d: number) => {
    let v = Math.max(0, form[k] + d);
    if (k === 'adultsOut' && v > occ.adults) { toast(`Es sind nur ${occ.adults} Erwachsene an Bord`); v = occ.adults; }
    if (k === 'kidsOut' && v > occ.kids) { toast(`Es sind nur ${occ.kids} Kinder an Bord`); v = occ.kids; }
    setForm({ ...form, [k]: v });
  };
  const emptyVehicle = () => {
    const idx = selIdx ?? stops.length - 1;
    void saveRecord(idx, { adultsIn: 0, kidsIn: 0, adultsOut: occ.adults, kidsOut: occ.kids }, true);
  };
  const undo = async () => {
    const last = tripRecs.at(-1);
    if (last) { await db.counts.delete(last.id); toast('Eintrag gelöscht'); }
  };

  let gpsText = '';
  if (sim.mode === 'gps' && sim.gpsError) gpsText = sim.gpsError;
  else if (!position) gpsText = sim.mode === 'sim-manual' ? 'Tippe in die Karte, um die Position zu setzen.' : 'Noch keine Position.';
  else {
    gpsText = `Position ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)} (${sim.mode === 'gps' ? `GPS ±${Math.round(sim.position?.accuracy ?? 0)} m` : 'Simulation'})`;
    if (stops.length) {
      if (atIdx >= 0) gpsText += ` · an ${stops[atIdx].name} (${formatDistance(distanceM(position, stops[atIdx]))}, Radius ${stops[atIdx].radius} m)`;
      else { const ni = Math.min(effLastIdx + 1, stops.length - 1); gpsText += ` · ${formatDistance(distanceM(position, stops[ni]))} bis ${stops[ni].name}`; }
    }
  }
  const mapLine = active?.line ?? lines[0];
  const stepper = (k: keyof Form, l: string, s: string) => (
    <div className="stp">
      <div className="stp-l">{l}<small>{s}</small></div>
      <button className="stp-b" onClick={() => step(k, -1)} aria-label={`${l} ${s}: eins weniger`}>−</button>
      <output>{form[k]}</output>
      <button className="stp-b plus" onClick={() => step(k, 1)} aria-label={`${l} ${s}: eins mehr`}>+</button>
    </div>
  );

  return (
    <div className="stack">
      {canDispose(user) && (
        <label className="f" style={{ maxWidth: 320 }}>
          Dienst ansehen als
          <select value={duty.id} onChange={(e) => pickDuty(e.target.value)}>
            {duties.map((d) => (
              <option key={d.id} value={d.id}>{users.find((u) => u.id === d.driverId)?.name} · {vehicles.find((v) => v.id === d.vehicleId)?.name}</option>
            ))}
          </select>
        </label>
      )}
      {reminder && (
        <div className="remind" role="alert"><span className="mono">{minSec(reminder.time - now)}</span><span>{reminder.text} um {hm(reminder.time)}</span></div>
      )}
      <div className="status">
        <div className={`lage ${status}`}>
          <div className="tag">Fahrplanlage</div>
          <div className="big">{big}</div>
          <div className="lbl">{label}</div>
          <div className="note">{sub}</div>
        </div>
        <div className="panel now">
          <div className="tag muted">Jetzt</div>
          <div className="what">{current ? itemTitle(current) : 'Keine Tätigkeit'}</div>
          <div className="note mono">{current ? `${hm(current.s)}–${hm(current.e)}${current.note ? ' · ' + current.note : ''}` : ''}</div>
          <div className="note">{next ? <>Danach: <b>{itemTitle(next)}</b> um <span className="mono">{hm(next.s)}</span></> : 'Keine weiteren Tätigkeiten heute.'}</div>
          <div className="note">Fahrzeug: {vehicles.find((v) => v.id === duty.vehicleId)?.name ?? '–'} · Fahrer/in: {users.find((u) => u.id === duty.driverId)?.name ?? '–'}</div>
        </div>
      </div>

      <div className="grid2">
        <section className="panel" aria-live="polite">
          <h2 className="sec">Fahrgäste erfassen</h2>
          {!active?.trip ? (
            <p className="empty">Die Erfassung öffnet sich 15 Minuten vor einer Linienfahrt. Sobald das Fahrzeug im Radius einer Haltestelle ist, wird sie automatisch gewählt.</p>
          ) : (
            <>
              <div className="note">{tripLabel(active.trip, active.line!)}</div>
              <div className="row spread" style={{ marginTop: 8 }}>
                <div>
                  <div className="stopname">{sel ? sel.name : 'Keine Haltestelle in Reichweite'}</div>
                  {sel && (atIdx === selIdx ? <span className="chip ok">im Radius</span> : <span className="chip">manuell gewählt</span>)}
                </div>
                <label className="f">
                  Haltestelle
                  <select
                    value={selAuto ? '' : String(selIdx)}
                    onChange={(e) => selectStop(e.target.value === '' ? null : Number(e.target.value))}
                  >
                    <option value="">automatisch (GPS)</option>
                    {stops.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="occ"><span>Im Fahrzeug</span><b>{occ.adults}</b><span>Erwachsene</span><b>{occ.kids}</b><span>Kinder</span></div>
              {stepper('adultsOut', 'Aussteigen', 'Erwachsene')}
              {stepper('kidsOut', 'Aussteigen', 'Kinder')}
              {stepper('adultsIn', 'Einsteigen', 'Erwachsene')}
              {stepper('kidsIn', 'Einsteigen', 'Kinder')}
              <div className="stack" style={{ marginTop: 14, gap: 10 }}>
                <button className="btn pri big" disabled={selIdx == null} onClick={() => selIdx != null && saveRecord(selIdx, form, false)}>Halt speichern</button>
                <button className={`btn big${isLast || lage?.kind === 'end' ? ' danger' : ''}`} disabled={occ.adults + occ.kids === 0} onClick={emptyVehicle}>
                  Fahrzeug leeren ({occ.adults + occ.kids} aussteigen lassen)
                </button>
              </div>
              <h3 className="h3">Erfasst auf dieser Fahrt</h3>
              {tripRecs.length ? (
                <>
                  <div className="tbl">
                    <table>
                      <thead><tr><th>Zeit</th><th>Haltestelle</th><th className="num">Ein E/K</th><th className="num">Aus E/K</th><th className="num">Lage</th></tr></thead>
                      <tbody>
                        {tripRecs.map((r) => (
                          <tr key={r.id}>
                            <td className="mono">{hm(r.time)}</td>
                            <td>{r.stopName}{r.emptied && <> <span className="chip">geleert</span></>}</td>
                            <td className="num">{r.adultsIn}/{r.kidsIn}</td>
                            <td className="num">{r.adultsOut}/{r.kidsOut}</td>
                            <td className="num">{r.delay == null ? '–' : signedMinSec(r.delay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn sm" style={{ marginTop: 8 }} onClick={undo}>Letzten Eintrag löschen</button>
                </>
              ) : <p className="note">Noch nichts erfasst.</p>}
            </>
          )}
        </section>

        <div className="stack">
          <section className="panel">
            <h2 className="sec">Strecke</h2>
            {mapLine && (
              <MapView
                stops={active?.trip ? stops : mapLine.stops}
                color={mapLine.color}
                fitKey={(active?.tripId ?? 'none') + mapLine.id}
                vehicle={position}
                onMapClick={sim.mode === 'sim-manual' ? sim.setManualPosition : undefined}
              />
            )}
            <p className="note" style={{ marginTop: 8 }}>{gpsText}</p>
          </section>
          <section className="panel">
            <h2 className="sec">Dienstplan heute</h2>
            <ol className="plan">
              {items.map((i) => (
                <li key={i.id} className={current?.id === i.id ? 'cur' : next?.id === i.id ? 'next' : i.e <= now ? 'past' : ''}>
                  <span className="mono">{hm(i.s)}–{hm(i.e)}</span>
                  <span><span className="tag">{DUTY_TYPES[i.type]}</span><br />{i.type === 'fahrt' ? itemTitle(i) : i.note}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
      <SimPanel firstStart={items[0]?.s ?? null} />
    </div>
  );
}
