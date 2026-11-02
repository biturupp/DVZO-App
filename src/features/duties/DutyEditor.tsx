import { useState } from 'react';
import { db, uid } from '../../data/db';
import { today, useCalendars, useDutiesOn, useLines, useTrips, useUsers, useVehicles } from '../../data/hooks';
import { holidayName, runsOn } from '../../domain/calendar';
import { overlappingItems, resolveItems, tripLabel, tripTimes } from '../../domain/schedule';
import { hm } from '../../domain/time';
import { DUTY_TYPES, ROLE_LABELS, type Duty, type DutyItem, type DutyType } from '../../domain/types';
import { ensureSeeded } from '../../data/seed';
import { toast } from '../../ui/toast';
import { TimeInput } from '../../ui/TimeInput';
import { serverMode } from '../../data/supabase';
import { DateInput } from '../../ui/DateInput';

const DEFAULT_MIN: Record<DutyType, number> = { anfahrt: 20, fahrt: 0, pause: 30, wechsel: 20, tanken: 15, putzen: 20, rueckfahrt: 20 };

/** Modul c: Dienstpläne (Fahrer, Fahrzeug, Tätigkeiten) sowie Fahrer- und Fahrzeugstamm. */
export function DutyEditor() {
  const [date, setDate] = useState(today());
  const [editId, setEditId] = useState<string | null>(null);
  const duties = useDutiesOn(date);
  const users = useUsers();
  const vehicles = useVehicles();
  const lines = useLines();
  const trips = useTrips();
  const [resetArm, setResetArm] = useState(false);
  const duty = duties.find((d) => d.id === editId) ?? null;

  const save = (d: Duty) => db.duties.put({ ...d, sample: false });
  const addDuty = async () => {
    const id = uid('d');
    await db.duties.add({ id, date, driverId: (users.find((u) => u.role === 'fahrer' && u.active !== false) ?? users[0])?.id ?? '', vehicleId: (vehicles.find((v) => v.active !== false) ?? vehicles[0])?.id ?? '', items: [] });
    setEditId(id);
  };

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row spread">
          <h2 className="sec m0">Dienste</h2>
          <div className="row">
            <label className="f">Datum<DateInput value={date} allowEmpty={false} onChange={(v) => { setDate(v); setEditId(null); }} /></label>
            <button className="btn pri" onClick={addDuty}>+ Dienst</button>
          </div>
        </div>
        {duties.length ? (
          <div className="tbl">
            <table>
              <thead><tr><th>Fahrer/in</th><th>Fahrzeug</th><th>Zeit</th><th className="num">Fahrten</th><th /></tr></thead>
              <tbody>
                {duties.map((d) => {
                  const its = resolveItems(d, trips, lines);
                  return (
                    <tr key={d.id}>
                      <td>{users.find((u) => u.id === d.driverId)?.name}</td>
                      <td>{vehicles.find((v) => v.id === d.vehicleId)?.name}</td>
                      <td className="mono">{its.length ? `${hm(its[0].s)}–${hm(its[its.length - 1].e)}` : '–'}</td>
                      <td className="num">{its.filter((i) => i.type === 'fahrt').length}</td>
                      <td><button className={`btn sm${d.id === editId ? ' pri' : ''}`} onClick={() => setEditId(d.id)}>Bearbeiten</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">An diesem Tag sind keine Dienste geplant.</p>}
      </section>

      {duty && <DutyForm duty={duty} onSave={save} onClose={() => setEditId(null)} />}

      <div className="grid2">
        {!serverMode && <section className="panel stack" style={{ alignContent: 'start' }}>
          <h2 className="sec m0">Daten auf diesem Gerät</h2>
          <p className="note">Bis der Server angebunden ist, liegen alle Daten nur auf diesem Gerät.</p>
          <button
            style={{ justifySelf: 'start' }}
            className={`btn${resetArm ? ' danger' : ''}`}
            onClick={async () => {
              if (!resetArm) { setResetArm(true); setTimeout(() => setResetArm(false), 5000); return; }
              await ensureSeeded(db, true);
              setResetArm(false);
              setEditId(null);
              toast('Beispieldaten wiederhergestellt');
            }}
          >
            {resetArm ? 'Wirklich alles zurücksetzen?' : 'Beispieldaten wiederherstellen'}
          </button>
        </section>}
      </div>
    </div>
  );
}

function DutyForm({ duty, onSave, onClose }: { duty: Duty; onSave: (d: Duty) => void; onClose: () => void }) {
  const users = useUsers();
  const vehicles = useVehicles();
  const lines = useLines();
  const allTrips = useTrips();
  const calendars = useCalendars();
  const runs = (t: { calendarId?: string | null }) => runsOn(calendars.find((c) => c.id === t.calendarId), duty.date);
  const trips = allTrips.filter(runs);
  const its = resolveItems(duty, allTrips, lines);
  const hol = holidayName(duty.date);
  const bad = overlappingItems(its);
  const setItem = (id: string, patch: Partial<DutyItem>) => onSave({ ...duty, items: duty.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const addItem = (type: DutyType) => {
    const lastE = its.length ? its[its.length - 1].e : 420;
    if (type === 'fahrt') {
      const nx = trips.map((t) => ({ t, s: tripTimes(t, lines.find((l) => l.id === t.lineId))[0] })).filter((x) => x.s >= lastE).sort((a, b) => a.s - b.s)[0];
      onSave({ ...duty, items: [...duty.items, { id: uid('i'), type, start: null, end: null, note: '', tripId: nx?.t.id ?? null }] });
    } else {
      onSave({ ...duty, items: [...duty.items, { id: uid('i'), type, start: hm(lastE + 5), end: hm(lastE + 5 + DEFAULT_MIN[type]), note: '', tripId: null }] });
    }
  };
  const tripOptions = lines.map((l) => (
    <optgroup key={l.id} label={l.name}>
      {allTrips.filter((t) => t.lineId === l.id).sort((a, b) => (a.dir === b.dir ? tripTimes(a, l)[0] - tripTimes(b, l)[0] : a.dir < b.dir ? -1 : 1)).map((t) => (
        <option key={t.id} value={t.id} disabled={!runs(t)}>{tripLabel(t, l)}{runs(t) ? '' : ' (verkehrt an diesem Tag nicht)'}</option>
      ))}
    </optgroup>
  ));


  return (
    <section className="panel stack">
      <div className="row spread"><h2 className="sec m0">Dienst bearbeiten</h2><button className="btn sm" onClick={onClose}>Schliessen</button></div>
      {hol && <p className="note">Dieser Tag ist ein Feiertag ({hol}).</p>}
      <div className="row">
        <label className="f">Datum<DateInput value={duty.date} allowEmpty={false} onChange={(v) => onSave({ ...duty, date: v })} /></label>
        <label className="f">Fahrer/in
          <select value={duty.driverId} onChange={(e) => onSave({ ...duty, driverId: e.target.value })}>
            {users.filter((u) => u.active !== false || u.id === duty.driverId).sort((a, b) => Number(a.role !== 'fahrer') - Number(b.role !== 'fahrer') || a.name.localeCompare(b.name, 'de')).map((u) => <option key={u.id} value={u.id}>{u.name}{u.role !== 'fahrer' ? ` (${ROLE_LABELS[u.role]})` : ''}</option>)}
          </select>
        </label>
        <label className="f">Fahrzeug
          <select value={duty.vehicleId} onChange={(e) => onSave({ ...duty, vehicleId: e.target.value })}>
            {vehicles.filter((v) => v.active !== false || v.id === duty.vehicleId).map((v) => <option key={v.id} value={v.id}>{v.name}{v.active === false ? ' (inaktiv)' : ''}</option>)}
          </select>
        </label>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Tätigkeit</th><th>Von</th><th>Bis</th><th>Kurs / Notiz</th><th /></tr></thead>
          <tbody>
            {its.map((i) => (
              <tr key={i.id}>
                <td>
                  <select value={i.type} onChange={(e) => setItem(i.id, { type: e.target.value as DutyType, ...(e.target.value !== 'fahrt' && !i.start ? { start: hm(i.s), end: hm(i.s + 30) } : {}) })}>
                    {Object.entries(DUTY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {bad.has(i.id) && <div className="warn-t">überschneidet sich</div>}
                  {i.trip && !runs(i.trip) && <div className="warn-t">Kurs verkehrt an diesem Tag nicht</div>}
                </td>
                {i.type === 'fahrt' ? (
                  <>
                    <td className="mono">{hm(i.s)}</td>
                    <td className="mono">{hm(i.e)}</td>
                    <td>
                      <select value={i.tripId ?? ''} onChange={(e) => setItem(i.id, { tripId: e.target.value || null })}>
                        <option value="">Kurs wählen …</option>{tripOptions}
                      </select>
                    </td>
                  </>
                ) : (
                  <>
                    <td><TimeInput aria-label="Von" allowEmpty value={i.start ?? ''} onCommit={(v) => setItem(i.id, { start: v || null })} /></td>
                    <td><TimeInput aria-label="Bis" allowEmpty value={i.end ?? ''} onCommit={(v) => setItem(i.id, { end: v || null })} /></td>
                    <td><input type="text" defaultValue={i.note} onBlur={(e) => setItem(i.id, { note: e.target.value })} placeholder="z. B. Ort" /></td>
                  </>
                )}
                <td><button className="btn sm" onClick={() => onSave({ ...duty, items: duty.items.filter((x) => x.id !== i.id) })} aria-label="Tätigkeit löschen">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="btn pri" onClick={() => addItem('fahrt')}>+ Linienfahrt</button>
        {(['pause', 'anfahrt', 'wechsel', 'tanken', 'putzen', 'rueckfahrt'] as DutyType[]).map((t) => (
          <button key={t} className="btn" onClick={() => addItem(t)}>+ {DUTY_TYPES[t]}</button>
        ))}
      </div>
      <button className="btn sm danger" style={{ justifySelf: 'start' }} onClick={async () => { await db.duties.delete(duty.id); onClose(); }}>Dienst löschen</button>
    </section>
  );
}
