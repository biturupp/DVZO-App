import { useEffect, useState } from 'react';
import { db } from '../../data/db';
import { useSettings } from '../../data/hooks';
import { hm, parseHm, signedMinSec } from '../../domain/time';
import { enableSound, keepScreenOn, soundEnabled } from '../../ui/sound';
import { toast } from '../../ui/toast';
import { useSim, type PositionMode } from './SimContext';

let initialised = false;

export function SimPanel({ firstStart }: { firstStart: number | null }) {
  const sim = useSim();
  const settings = useSettings();
  const defaultStart = firstStart != null ? firstStart - 5 : 415;
  const [start, setStart] = useState(hm(defaultStart));
  const [sound, setSound] = useState(soundEnabled());

  // Beim ersten Öffnen die Simulation kurz vor Dienstbeginn starten
  useEffect(() => {
    if (!initialised && sim.clock.sim && firstStart != null) {
      initialised = true;
      sim.setClock(true, defaultStart, 10);
      setStart(hm(defaultStart));
    }
  }, [firstStart]);

  return (
    <details className="sim" open={sim.clock.sim || sim.mode !== 'gps'}>
      <summary>Uhr, GPS und Test-Simulation</summary>
      <p className="note">
        Im Fahrzeug nutzt die App die echte Uhrzeit und das GPS des Handys. Zum Ausprobieren am Schreibtisch laufen Uhr und Position simuliert.
      </p>
      <div className="simgrid">
        <label className="f">
          Uhr
          <select value={sim.clock.sim ? 'sim' : 'real'} onChange={(e) => sim.setClock(e.target.value === 'sim', e.target.value === 'sim' ? parseHm(start) ?? 415 : undefined)}>
            <option value="sim">Simulierte Zeit</option>
            <option value="real">Echte Uhrzeit</option>
          </select>
        </label>
        <label className="f">
          Simulation starten um
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="f">
          Tempo
          <select value={sim.clock.speed} onChange={(e) => sim.setClock(sim.clock.sim, undefined, Number(e.target.value))}>
            {[0, 1, 5, 10, 30, 60].map((s) => <option key={s} value={s}>{s ? `${s}× schneller` : 'Pause'}</option>)}
          </select>
        </label>
        <label className="f">
          Position
          <select value={sim.mode} onChange={(e) => sim.setMode(e.target.value as PositionMode)}>
            <option value="sim-auto">Fahrzeug fährt nach Fahrplan</option>
            <option value="sim-manual">Position per Tipp auf die Karte</option>
            <option value="gps">Echtes GPS des Geräts</option>
          </select>
        </label>
        <label className="f">
          Simulierte Abweichung: {signedMinSec(sim.simDelay)} Min.
          <input type="range" min={-4} max={8} step={0.5} value={sim.simDelay} onChange={(e) => sim.setSimDelay(Number(e.target.value))} />
        </label>
        <label className="f">
          Erinnerung vor Abfahrt (Min.)
          <input
            type="number" min={1} max={30} value={settings?.remindMinutes ?? 3}
            onChange={(e) => db.settings.put({ id: 'settings', remindMinutes: Math.max(1, Number(e.target.value) || 3) })}
          />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { const v = parseHm(start) ?? 415; sim.setClock(true, v); toast(`Simulation startet um ${hm(v)}`); }}>
          Simulation neu starten
        </button>
        <button
          className="btn"
          onClick={async () => {
            const ok = await enableSound();
            setSound(ok);
            await keepScreenOn();
            toast(ok ? 'Ton aktiv, Bildschirm bleibt eingeschaltet' : 'Ton ist auf diesem Gerät nicht verfügbar');
          }}
        >
          {sound ? 'Ton ist aktiv' : 'Ton und Bildschirm aktivieren'}
        </button>
      </div>
    </details>
  );
}
