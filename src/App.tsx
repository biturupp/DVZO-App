import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { useUsers } from './data/hooks';
import { DriveView } from './features/drive/DriveView';
import { useSim } from './features/drive/SimContext';
import { DutyEditor } from './features/duties/DutyEditor';
import { LinesEditor } from './features/lines/LinesEditor';
import { Reports } from './features/reports/Reports';
import { TimetableEditor } from './features/timetable/TimetableEditor';
import { hm } from './domain/time';

type Tab = 'fahrt' | 'linien' | 'fahrplan' | 'dienst' | 'auswertung';

const ADMIN_TABS: [Tab, string][] = [['fahrt', 'Fahrt'], ['linien', 'Linien'], ['fahrplan', 'Fahrpläne'], ['dienst', 'Dienstplan'], ['auswertung', 'Auswertung']];
const DRIVER_TABS: [Tab, string][] = [['fahrt', 'Mein Dienst'], ['auswertung', 'Meine Zählungen']];

function useHashTab(allowed: Tab[]): [Tab, (t: Tab) => void] {
  const read = () => { const h = location.hash.slice(1) as Tab; return allowed.includes(h) ? h : 'fahrt'; };
  const [tab, setTab] = useState<Tab>(read);
  useEffect(() => {
    const on = () => setTab(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  });
  return [allowed.includes(tab) ? tab : 'fahrt', (t) => { location.hash = t; setTab(t); }];
}

export function App() {
  const { user, logout } = useAuth();
  if (!user) return <Login />;
  const tabs = user.role === 'admin' ? ADMIN_TABS : DRIVER_TABS;
  return <Shell tabs={tabs} userName={user.name} onLogout={logout} />;
}

function Shell({ tabs, userName, onLogout }: { tabs: [Tab, string][]; userName: string; onLogout: () => void }) {
  const [tab, setTab] = useHashTab(tabs.map((t) => t[0]));
  const sim = useSim();
  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="bar">
            <div className="brand"><b>DVZO-App</b><span>Oldtimerbetrieb DVZO</span></div>
            <span className="clock">{hm(sim.now)}</span>
            {sim.clock.sim && <span className="chip sim">Simulation {sim.clock.speed ? `${sim.clock.speed}×` : 'pausiert'}</span>}
            <span className="chip">{userName}</span>
            <button className="btn sm ghost" onClick={onLogout}>Abmelden</button>
          </div>
          <nav className="tabs" aria-label="Bereiche">
            {tabs.map(([k, l]) => <button key={k} aria-current={k === tab ? 'page' : undefined} onClick={() => setTab(k)}>{l}</button>)}
          </nav>
        </div>
      </header>
      <main className="wrap">
        {tab === 'fahrt' && <DriveView />}
        {tab === 'linien' && <LinesEditor />}
        {tab === 'fahrplan' && <TimetableEditor />}
        {tab === 'dienst' && <DutyEditor />}
        {tab === 'auswertung' && <Reports />}
      </main>
    </>
  );
}

function Login() {
  const users = useUsers();
  const { login } = useAuth();
  const [sel, setSel] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const chosen = sel ?? users.find((u) => u.role === 'fahrer')?.id ?? users[0]?.id;
  const submit = async () => {
    if (!chosen) return;
    if (!(await login(chosen, pin))) { setErr('PIN stimmt nicht. Bitte erneut eingeben.'); setPin(''); }
  };
  return (
    <main className="wrap">
      <div className="login">
        <div>
          <h1 className="title">DVZO-App</h1>
          <p className="note">Oldtimerbetrieb DVZO · Fahrgastzählung, Fahrpläne und Dienstpläne</p>
        </div>
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 className="sec m0">Anmelden</h2>
          <div className="users">
            {users.map((u) => (
              <button type="button" key={u.id} className="ucard" aria-pressed={u.id === chosen} onClick={() => setSel(u.id)}>
                <b>{u.name}</b><span>{u.role === 'admin' ? 'Disposition (alle Module)' : 'Fahrer/in'}</span>
              </button>
            ))}
          </div>
          <label className="f">PIN<input type="password" inputMode="numeric" autoComplete="off" placeholder="4 Ziffern" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
          {err && <p className="warn-t">{err}</p>}
          <button className="btn pri big" type="submit">Anmelden</button>
          <p className="note">Testbetrieb: Disposition 1234, Anna Keller 1111, Marco Brunner 2222.</p>
        </form>
      </div>
    </main>
  );
}
