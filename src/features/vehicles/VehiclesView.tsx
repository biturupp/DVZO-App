import { useState } from 'react';
import { db, uid } from '../../data/db';
import { useVehicles } from '../../data/hooks';
import { fmtDate } from '../../domain/time';
import type { Vehicle } from '../../domain/types';
import { DateInput } from '../../ui/DateInput';
import { toast } from '../../ui/toast';

const empty = (): Vehicle => ({ id: uid('v'), name: '', owner: '', brand: '', model: '', plate: '', lastInspection: '', active: true });

export function VehiclesView() {
  const vehicles = useVehicles();
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [delArm, setDelArm] = useState<string | null>(null);
  const sorted = [...vehicles].sort((a, b) => Number(a.active === false) - Number(b.active === false) || a.name.localeCompare(b.name, 'de', { numeric: true }));

  const toggle = async (v: Vehicle) => {
    const active = v.active === false;
    await db.vehicles.update(v.id, { active });
    toast(`${v.name} ist jetzt ${active ? 'aktiv' : 'inaktiv'}`);
  };

  const remove = async (v: Vehicle) => {
    if (delArm !== v.id) {
      setDelArm(v.id);
      setTimeout(() => setDelArm((d) => (d === v.id ? null : d)), 4000);
      return;
    }
    setDelArm(null);
    const duties = await db.duties.filter((d) => d.vehicleId === v.id).count();
    const counts = await db.counts.filter((c) => c.vehicleId === v.id).count();
    if (duties + counts > 0) {
      return toast(`${v.name} wird bereits in Diensten oder Zählungen verwendet und kann nicht gelöscht werden. Bitte stattdessen inaktiv setzen.`);
    }
    await db.vehicles.delete(v.id);
    toast(`${v.name} gelöscht`);
  };

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row spread">
          <h2 className="sec m0">Fahrzeuge</h2>
          {!edit && <button className="btn pri" onClick={() => setEdit(empty())}>+ Neues Fahrzeug</button>}
        </div>
        {sorted.length ? (
          <div className="tbl">
            <table>
              <thead>
                <tr><th>Betriebsnummer</th><th>Marke und Typ</th><th>Kontrollschild</th><th>Fahrzeughalter</th><th className="num">Sitzplätze</th><th>Letzte Prüfung</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {sorted.map((v) => (
                  <tr key={v.id} className={v.active === false ? 'inactive' : undefined}>
                    <td><b>{v.name}</b></td>
                    <td>{[v.brand, v.model].filter(Boolean).join(' ') || '–'}</td>
                    <td className="mono nowrap">{v.plate || '–'}</td>
                    <td>{v.owner || '–'}</td>
                    <td className="num">{v.seats ?? '–'}</td>
                    <td className="mono">{v.lastInspection ? fmtDate(v.lastInspection) : '–'}</td>
                    <td>{v.active === false ? <span className="status-off">Inaktiv</span> : <span className="status-ok">Aktiv</span>}</td>
                    <td className="nowrap">
                      <button className="btn sm" onClick={() => setEdit({ ...v })}>Bearbeiten</button>{' '}
                      <button className="btn sm" onClick={() => void toggle(v)}>{v.active === false ? 'Aktiv setzen' : 'Inaktiv setzen'}</button>{' '}
                      <button className={`btn sm${delArm === v.id ? ' danger' : ''}`} onClick={() => void remove(v)}>{delArm === v.id ? 'Wirklich löschen?' : 'Löschen'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">Noch keine Fahrzeuge erfasst.</p>}
        <p className="note m0">Inaktive Fahrzeuge erscheinen nicht mehr in der Auswahl im Dienstplan. Fahrzeuge, die schon in Diensten oder Zählungen vorkommen, lassen sich nur inaktiv setzen, nicht löschen.</p>
      </section>
      {edit && <VehicleForm key={edit.id} vehicle={edit} isNew={!vehicles.some((v) => v.id === edit.id)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function VehicleForm({ vehicle, isNew, onClose }: { vehicle: Vehicle; isNew: boolean; onClose: () => void }) {
  const [v, setV] = useState<Vehicle>(vehicle);
  const set = (patch: Partial<Vehicle>) => setV({ ...v, ...patch });
  const save = async () => {
    if (!v.name.trim()) return toast('Bitte eine Betriebsnummer eingeben');
    const seats = v.seats == null || Number.isNaN(v.seats) ? undefined : v.seats;
    await db.vehicles.put({ ...v, name: v.name.trim(), owner: v.owner?.trim(), brand: v.brand?.trim(), model: v.model?.trim(), plate: v.plate?.trim().toUpperCase(), seats });
    toast(`${v.name.trim()} gespeichert`);
    onClose();
  };
  return (
    <section className="panel stack inset">
      <h3 className="m0">{isNew ? 'Neues Fahrzeug' : `Fahrzeug «${vehicle.name}» bearbeiten`}</h3>
      <div className="row">
        <label className="f">Betriebsnummer<input type="text" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Saurer 1" autoFocus /></label>
        <label className="f grow1">Fahrzeughalter<input type="text" value={v.owner ?? ''} onChange={(e) => set({ owner: e.target.value })} placeholder="z. B. DVZO" /></label>
      </div>
      <div className="row">
        <label className="f grow1">Marke<input type="text" value={v.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} placeholder="z. B. Saurer" /></label>
        <label className="f grow1">Typ<input type="text" value={v.model ?? ''} onChange={(e) => set({ model: e.target.value })} placeholder="z. B. 3DUK" /></label>
        <label className="f">Kontrollschild<input type="text" value={v.plate ?? ''} onChange={(e) => set({ plate: e.target.value })} placeholder="ZH 12345" /></label>
      </div>
      <div className="row">
        <label className="f">Sitzplätze<input type="number" min={0} className="w-num" value={v.seats ?? ''} onChange={(e) => set({ seats: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <label className="f">Letzte Prüfung<DateInput value={v.lastInspection ?? ''} onChange={(d) => set({ lastInspection: d })} /></label>
        <label className="f">Status
          <select value={v.active === false ? 'inaktiv' : 'aktiv'} onChange={(e) => set({ active: e.target.value === 'aktiv' })}>
            <option value="aktiv">Aktiv</option>
            <option value="inaktiv">Inaktiv</option>
          </select>
        </label>
      </div>
      <div className="row">
        <button className="btn pri" onClick={() => void save()}>Speichern</button>
        <button className="btn ghost" onClick={onClose}>Abbrechen</button>
      </div>
    </section>
  );
}
