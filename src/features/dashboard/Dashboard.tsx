import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { latestToday, subscribeMessages, type Message } from '../../data/messages';
import { serverMode } from '../../data/supabase';
import { bandProgress } from '../../domain/drive';
import { distanceM, formatDistance } from '../../domain/geo';
import { itemTitle, tripStops, tripTimes } from '../../domain/schedule';
import { fmtDate, hm, minSec } from '../../domain/time';
import { canDispose } from '../../domain/types';
import { toast } from '../../ui/toast';
import { useDrive } from '../drive/DriveContext';
import { lageText } from '../drive/lageText';
import { useSim } from '../drive/SimContext';
import { Icon } from '../../ui/icons';

export function Dashboard({ onCount, onMenu, syncChip }: { onCount: () => void; onMenu: () => void; syncChip: React.ReactNode }) {
  const { user } = useAuth();
  const sim = useSim();
  const d = useDrive();
  const { now, duty, active, stops, times, arrivals, position, atIdx, effLastIdx, lage, occ, items, current, next, reminder } = d;
  const [info, setInfo] = useState(false);

  const vehicle = d.vehicles.find((v) => v.id === duty?.vehicleId);
  const driver = d.users.find((u) => u.id === duty?.driverId);

  // Linienband: laufende Fahrt, sonst die nächste Linienfahrt des Dienstes
  const upcoming = items.find((i) => i.type === 'fahrt' && i.trip && i.line && i.s > now) ?? null;
  const band = active ?? upcoming;
  const bStops = active ? stops : band?.trip && band.line ? tripStops(band.trip, band.line) : [];
  const bTimes = active ? times : band?.trip && band.line ? tripTimes(band.trip, band.line) : [];
  const progress = active ? bandProgress(stops, position, atIdx, effLastIdx) : 0;
  const pct = (i: number) => (bStops.length > 1 ? (i / (bStops.length - 1)) * 100 : 0);

  const title = band?.line
    ? `${band.line.name}${band.trip?.number ? ` · Kurs ${band.trip.number}` : ''} nach ${bStops.at(-1)?.name ?? ''}`
    : current ? itemTitle(current) : duty ? 'Kein laufender Kurs' : 'Kein Dienst heute';

  // Nächste bzw. aktuelle Haltestelle
  const atStop = active && atIdx >= 0;
  const target = !active ? -1 : atStop ? atIdx : effLastIdx < 0 ? 0 : Math.min(effLastIdx + 1, stops.length - 1);
  const lt = lageText(lage, stops, times, effLastIdx, now);
  const running = lage?.kind === 'run' && lage.value != null;
  const eta = target >= 0 ? (running ? arrivals[target] + lage!.value! : atStop || target === 0 ? times[target] : arrivals[target]) : null;
  const dist = target >= 0 && position && !atStop ? formatDistance(distanceM(position, stops[target])) : null;
  const onBoard = occ.adults + occ.kids;

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="dash-title">
          <h1>{title}</h1>
          <p>
            {canDispose(user) && d.duties.length > 1 ? (
              <>
                Dienst ansehen als
                <select className="dash-pick" aria-label="Dienst ansehen als" value={duty?.id} onChange={(e) => d.pickDuty(e.target.value)}>
                  {d.duties.map((x) => (
                    <option key={x.id} value={x.id}>{d.users.find((u) => u.id === x.driverId)?.name} · {d.vehicles.find((v) => v.id === x.vehicleId)?.name}</option>
                  ))}
                </select>
                {vehicle?.plate && <>({vehicle.plate})</>}
              </>
            ) : (
              <>
                {driver?.name ?? user?.name}
                {vehicle && <> · {vehicle.name}{vehicle.plate ? ` (${vehicle.plate})` : ''}</>}
              </>
            )}
          </p>
        </div>
        <div className="dash-chips">
          {sim.clock.sim && <span className="chip sim">Simulation {sim.clock.speed ? `${sim.clock.speed}×` : 'pausiert'}</span>}
          <GpsChip />
          {syncChip}
        </div>
        <span className="dash-clock mono">{hm(now)}</span>
      </header>

      {reminder && (
        <div className="remind" role="alert"><span className="mono">{minSec(reminder.time - now)}</span><span>{reminder.text} um {hm(reminder.time)}</span></div>
      )}

      <section className="dash-card band" aria-label="Linienband">
        {bStops.length > 1 ? (
          <>
            <div className="band-track">
              <div className="band-rail" />
              <div className="band-fill" style={{ width: `${pct(progress)}%` }} />
              {bStops.map((s, i) => (
                <span
                  key={s.id}
                  className={`band-dot${i === target ? ' target' : i <= progress && active ? ' done' : ''}`}
                  style={{ left: `${pct(i)}%` }}
                  title={s.name}
                />
              ))}
              {active && <span className="band-bus" style={{ left: `${pct(progress)}%` }}><Icon name="bus" size={20} /></span>}
            </div>
            <div className="band-labels">
              {bStops.map((s, i) => (
                <span
                  key={s.id}
                  className={`band-label${i === 0 ? ' first' : i === bStops.length - 1 ? ' last' : ''}${i === target ? ' target' : ''}`}
                  style={{ left: `${pct(i)}%`, maxWidth: `${Math.max(10, 100 / Math.max(1, bStops.length - 1))}%` }}
                >
                  <b>{s.name}</b>
                  <span className="mono">{hm(bTimes[i])}</span>
                </span>
              ))}
            </div>
            {!active && upcoming && <p className="note m0">Nächste Linienfahrt ab {hm(upcoming.s)}. Das Fahrzeug erscheint 15 Minuten vor Abfahrt auf dem Band.</p>}
          </>
        ) : (
          <p className="note m0">{duty ? 'Heute ist keine weitere Linienfahrt geplant.' : 'Für heute ist dir kein Dienst zugeteilt.'}</p>
        )}
      </section>

      <div className="dash-grid">
        <section className={`dash-card next ${lt.status}`}>
          <span className="dash-cap">{atStop ? 'An der Haltestelle' : 'Nächste Haltestelle'}</span>
          {target >= 0 ? (
            <>
              <h2 className="dash-stop">{stops[target].name}</h2>
              <div className="dash-tiles">
                <div className="dash-tile">
                  <span>{running ? 'Ankunft geschätzt' : target === stops.length - 1 ? 'Ankunft laut Fahrplan' : 'Abfahrt laut Fahrplan'}</span>
                  <b className="mono">{hm(eta)}</b>
                </div>
                <div className="dash-tile">
                  <span>Distanz</span>
                  <b className="mono">{atStop ? 'hier' : dist ?? '–'}</b>
                </div>
                <div className={`dash-tile lage ${lt.status}`}>
                  <span>{lt.label}</span>
                  <b className="mono">{lt.big}</b>
                </div>
              </div>
              {lt.sub && <p className="note m0">{lt.sub}</p>}
            </>
          ) : (
            <>
              <h2 className="dash-stop">{next ? itemTitle(next) : current ? itemTitle(current) : '–'}</h2>
              <p className="note m0">{next ? `Beginnt um ${hm(next.s)}.` : current ? `Bis ${hm(current.e)}.` : 'Keine weiteren Tätigkeiten heute.'}</p>
            </>
          )}
          <div className="dash-board">
            <Icon name="people" size={26} />
            <span><b className="mono">{onBoard}</b> an Bord{vehicle?.seats ? ` · ${Math.max(0, vehicle.seats - onBoard)} freie Plätze` : ''}</span>
            <span className="note">{occ.kids ? `davon ${occ.kids} Kinder` : ''}</span>
          </div>
        </section>

        <section className="dash-card duty" aria-label="Mein Dienst heute">
          <span className="dash-cap">Mein Dienst heute</span>
          {items.length ? (
            <ol className="dash-plan">
              {items.map((i) => (
                <li key={i.id} ref={current?.id === i.id || (!current && next?.id === i.id) ? scrollIntoView : undefined} className={current?.id === i.id ? 'cur' : i.e <= now ? 'past' : next?.id === i.id ? 'next' : ''}>
                  <span className="mono">{hm(i.s)}</span>
                  <span>{itemTitle(i)}{i.type !== 'fahrt' && i.note ? ` · ${i.note}` : ''}</span>
                </li>
              ))}
            </ol>
          ) : <p className="note m0">Kein Dienst eingeteilt.</p>}
          <DispoNote />
        </section>
      </div>

      <nav className="dash-actions" aria-label="Hauptfunktionen">
        <button className="act blue" onClick={onCount}><Icon name="people" size={30} />Frequenz</button>
        <button className="act red" onClick={() => toast('Der Billettverkauf folgt in einem nächsten Schritt.')}><Icon name="ticket" size={30} />Billette</button>
        <button className="act outline" onClick={() => setInfo(true)}><Icon name="info" size={30} />Infos</button>
        <button className="act dark" onClick={onMenu}><Icon name="menu" size={30} />Mehr</button>
      </nav>

      {info && <InfoDialog onClose={() => setInfo(false)} />}
    </div>
  );
}

/** Hält die laufende Tätigkeit in der Dienstliste sichtbar. */
const scrollIntoView = (el: HTMLLIElement | null) => el?.scrollIntoView({ block: 'nearest' });

function GpsChip() {
  const sim = useSim();
  if (sim.mode !== 'gps') return <span className="chip">Position simuliert</span>;
  if (sim.gpsError) return <span className="chip warn" title={sim.gpsError}>Kein GPS</span>;
  if (!sim.position) return <span className="chip">GPS sucht …</span>;
  return <span className="chip ok">GPS ±{Math.round(sim.position.accuracy ?? 0)} m</span>;
}

function DispoNote() {
  const { user } = useAuth();
  const users = useDrive().users;
  const [msg, setMsg] = useState<Message | null>(null);
  useEffect(() => {
    if (!serverMode || !user) return;
    const load = () => { if (navigator.onLine) latestToday(user.id).then(setMsg).catch(() => {}); };
    load();
    const off = subscribeMessages(user.id, (m) => setMsg(m), 'dash');
    addEventListener('online', load);
    return () => { off(); removeEventListener('online', load); };
  }, [user?.id]);
  if (!msg) return <p className="dash-msg empty-msg">Keine Meldung der Disposition.</p>;
  const time = new Date(msg.createdAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', hour12: false });
  const from = users.find((u) => u.id === msg.senderId)?.name ?? 'Disposition';
  return <p className="dash-msg"><b>{from} {time}:</b> {msg.body}</p>;
}

function InfoDialog({ onClose }: { onClose: () => void }) {
  const d = useDrive();
  const sim = useSim();
  const v = d.vehicles.find((x) => x.id === d.duty?.vehicleId);
  const line = d.active?.line ?? d.items.find((i) => i.line)?.line ?? null;
  const row = (k: string, val: React.ReactNode) => <><dt>{k}</dt><dd>{val || '–'}</dd></>;
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel stack" role="dialog" aria-labelledby="info-h">
        <div className="row spread"><h2 id="info-h" className="sec m0">Infos</h2><button className="btn sm ghost" onClick={onClose}>Schliessen</button></div>
        <h3 className="m0">Fahrzeug</h3>
        {v ? (
          <dl className="kv">
            {row('Betriebsnummer', v.name)}
            {row('Marke und Typ', [v.brand, v.model].filter(Boolean).join(' '))}
            {row('Kontrollschild', v.plate)}
            {row('Sitzplätze', v.seats)}
            {row('Fahrzeughalter', v.owner)}
            {row('Letzte Prüfung', v.lastInspection ? fmtDate(v.lastInspection) : '')}
          </dl>
        ) : <p className="note m0">Kein Fahrzeug zugeteilt.</p>}
        <h3 className="m0">Linie</h3>
        {line ? (
          <dl className="kv">
            {row('Linie', line.name)}
            {row('Strecke', line.route)}
            {row('Verkehrt', line.days)}
            {row('Haltestellen', line.stops.length)}
          </dl>
        ) : <p className="note m0">Heute keine Linienfahrt.</p>}
        <h3 className="m0">Gerät</h3>
        <dl className="kv">
          {row('Uhr', sim.clock.sim ? `Simulation (${sim.clock.speed}×)` : 'Echtzeit')}
          {row('App-Version', __APP_VERSION__)}
          {row('Position', sim.mode === 'gps' ? (sim.gpsError || (sim.position ? `GPS ±${Math.round(sim.position.accuracy ?? 0)} m` : 'GPS sucht …')) : 'Simulation')}
        </dl>
      </div>
    </div>
  );
}
