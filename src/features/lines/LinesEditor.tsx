import { useState } from 'react';
import { db, uid } from '../../data/db';
import { useLines } from '../../data/hooks';
import { parseCoordinates, type LatLon } from '../../domain/geo';
import type { Line, Stop } from '../../domain/types';
import { MapView } from '../../ui/MapView';
import { toast } from '../../ui/toast';

/** Modul a: Linien und Haltestellen erfassen, per Karte oder Koordinaten. */
export function LinesEditor() {
  const lines = useLines();
  const [lineId, setLineId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [coord, setCoord] = useState('');
  const line = lines.find((l) => l.id === lineId) ?? lines[0];

  const update = (patch: Partial<Line>) => line && db.lines.update(line.id, patch);
  const updateStop = (id: string, patch: Partial<Stop>) => line && update({ stops: line.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const addStop = (p: LatLon, n?: string) => {
    if (!line) return;
    const s: Stop = { id: uid('s'), name: n || `Neue Haltestelle ${line.stops.length + 1}`, lat: p.lat, lon: p.lon, radius: 200 };
    update({ stops: [...line.stops, s] });
    toast(`${s.name} hinzugefügt`);
  };
  const move = (i: number, d: number) => {
    if (!line) return;
    const st = [...line.stops];
    [st[i], st[i + d]] = [st[i + d], st[i]];
    update({ stops: st });
  };
  const remove = async (id: string) => {
    if (!line) return;
    await update({ stops: line.stops.filter((s) => s.id !== id) });
    await db.trips.where('lineId').equals(line.id).modify((t) => { delete t.times[id]; });
  };
  const addLine = async () => {
    const id = uid('L');
    await db.lines.add({ id, name: `Linie ${lines.length + 1}`, route: 'Neue Strecke', color: '#2763a8', days: 'Mo–Fr', stops: [] });
    setLineId(id);
  };

  return (
    <div className="stack">
      <div className="linelist">
        {lines.map((l) => (
          <button key={l.id} className={`btn${l.id === line?.id ? ' pri' : ''}`} onClick={() => setLineId(l.id)}>
            <span className="swatch" style={{ background: l.color }} />{l.name}
          </button>
        ))}
        <button className="btn ghost" onClick={addLine}>+ Neue Linie</button>
      </div>
      {line && (
        <div className="grid2">
          <section className="panel stack">
            <h2 className="sec m0">Linie</h2>
            <div className="row">
              <label className="f grow1">Name<input type="text" defaultValue={line.name} key={line.id + 'n'} onBlur={(e) => update({ name: e.target.value })} /></label>
              <label className="f grow2">Strecke<input type="text" defaultValue={line.route} key={line.id + 'r'} onBlur={(e) => update({ route: e.target.value })} /></label>
              <label className="f">Farbe<input type="color" value={line.color} onChange={(e) => update({ color: e.target.value })} /></label>
            </div>
            <MapView stops={line.stops} color={line.color} fitKey={line.id} onMapClick={(p) => addStop(p)} height={380} />
            <p className="note">Tippe in die Karte, um am Ende der Linie eine Haltestelle zu setzen.</p>
          </section>
          <section className="panel stack">
            <h2 className="sec m0">Haltestelle per Koordinaten</h2>
            <div className="row">
              <label className="f grow1">Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Hulftegg, Passhöhe" /></label>
              <label className="f grow2">Koordinaten<input type="text" value={coord} onChange={(e) => setCoord(e.target.value)} placeholder="47.3868, 8.9690 oder 2 711 000 1 245 000" /></label>
              <button
                className="btn pri"
                onClick={() => {
                  const c = parseCoordinates(coord);
                  if (!c) return toast('Koordinaten nicht erkannt. Beispiel: 47.3868, 8.9690');
                  addStop(c, name.trim());
                  setName('');
                  setCoord('');
                }}
              >
                Hinzufügen
              </button>
            </div>
            <p className="note">
              Akzeptiert WGS84 (z. B. aus Google Maps) und Schweizer Landeskoordinaten LV95/LV03. Koordinaten findest du auf{' '}
              <a href="https://map.geo.admin.ch" target="_blank" rel="noopener">map.geo.admin.ch</a> per Rechtsklick.
            </p>
            <div className="tbl">
              <table>
                <thead><tr><th>#</th><th>Haltestelle</th><th>Breite</th><th>Länge</th><th className="num">Radius m</th><th /></tr></thead>
                <tbody>
                  {line.stops.map((s, i) => (
                    <tr key={s.id}>
                      <td className="mono">{i + 1}</td>
                      <td><input type="text" defaultValue={s.name} onBlur={(e) => updateStop(s.id, { name: e.target.value })} /></td>
                      <td><input type="number" step="0.0001" className="w-coord" defaultValue={s.lat.toFixed(5)} onBlur={(e) => updateStop(s.id, { lat: Number(e.target.value) || s.lat })} /></td>
                      <td><input type="number" step="0.0001" className="w-coord" defaultValue={s.lon.toFixed(5)} onBlur={(e) => updateStop(s.id, { lon: Number(e.target.value) || s.lon })} /></td>
                      <td className="num"><input type="number" step="10" min="20" className="w-num" defaultValue={s.radius} onBlur={(e) => updateStop(s.id, { radius: Number(e.target.value) || 200 })} /></td>
                      <td className="nowrap">
                        <button className="btn sm" disabled={!i} onClick={() => move(i, -1)} aria-label="nach oben">↑</button>{' '}
                        <button className="btn sm" disabled={i === line.stops.length - 1} onClick={() => move(i, 1)} aria-label="nach unten">↓</button>{' '}
                        <button className="btn sm" onClick={() => remove(s.id)} aria-label="löschen">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
