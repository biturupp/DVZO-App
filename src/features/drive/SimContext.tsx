import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LatLon } from '../../domain/geo';
import { minutesOfDay } from '../../domain/time';

/**
 * Uhr und Position. Im Fahrzeug: echte Zeit + GPS des Handys.
 * Zum Testen am Schreibtisch: simulierte Zeit (beschleunigt) und simulierte Fahrt nach Fahrplan.
 */
export type PositionMode = 'gps' | 'sim-auto' | 'sim-manual';

interface ClockState {
  sim: boolean;
  base: number;
  at: number;
  speed: number;
}

interface SimState {
  now: number;
  clock: ClockState;
  setClock: (sim: boolean, start?: number, speed?: number) => void;
  mode: PositionMode;
  setMode: (m: PositionMode) => void;
  position: (LatLon & { accuracy?: number }) | null;
  setManualPosition: (p: LatLon | null) => void;
  gpsError: string;
  simDelay: number;
  setSimDelay: (v: number) => void;
}

const Ctx = createContext<SimState | null>(null);

const readNow = (c: ClockState) => (c.sim ? c.base + ((performance.now() - c.at) / 60000) * c.speed : minutesOfDay(new Date()));

export function SimProvider({ children }: { children: ReactNode }) {
  // Im Testbetrieb startet die Simulation; im Produktivbetrieb (VITE_DEFAULT_REALTIME=1) echte Zeit und GPS.
  const realDefault = import.meta.env.VITE_DEFAULT_REALTIME === '1';
  const [clock, setClockState] = useState<ClockState>({ sim: !realDefault, base: 415, at: performance.now(), speed: 10 });
  const [now, setNow] = useState(() => readNow(clock));
  const [mode, setMode] = useState<PositionMode>(realDefault ? 'gps' : 'sim-auto');
  const [gpsPos, setGpsPos] = useState<SimState['position']>(null);
  const [manualPos, setManualPosition] = useState<LatLon | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [simDelay, setSimDelay] = useState(1.5);
  const clockRef = useRef(clock);
  clockRef.current = clock;

  useEffect(() => {
    const t = setInterval(() => setNow(readNow(clockRef.current)), 1000);
    return () => clearInterval(t);
  }, []);

  const setClock = useCallback((sim: boolean, start?: number, speed?: number) => {
    setClockState((c) => {
      const n = readNow(c);
      const next = { sim, base: start ?? n, at: performance.now(), speed: speed ?? c.speed };
      setNow(readNow(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (mode !== 'gps') return;
    if (!navigator.geolocation) {
      setGpsError('Dieses Gerät stellt kein GPS zur Verfügung.');
      return;
    }
    setGpsError('');
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGpsPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy });
        setGpsError('');
      },
      (e) => setGpsError(`GPS nicht verfügbar: ${e.message || 'Zugriff verweigert'}.`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [mode]);

  const position = mode === 'gps' ? gpsPos : mode === 'sim-manual' ? manualPos : null;

  return (
    <Ctx.Provider value={{ now, clock, setClock, mode, setMode, position, setManualPosition, gpsError, simDelay, setSimDelay }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSim() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSim ausserhalb von SimProvider');
  return c;
}
