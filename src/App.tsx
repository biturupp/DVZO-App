import { useEffect, useState } from 'react';
import { toast } from './ui/toast';
import { useAuth } from './auth/AuthContext';
import { useUsers } from './data/hooks';
import { DriveView } from './features/drive/DriveView';
import { useSim } from './features/drive/SimContext';
import { DutyEditor } from './features/duties/DutyEditor';
import { LinesEditor } from './features/lines/LinesEditor';
import { Reports } from './features/reports/Reports';
import { TimetableEditor } from './features/timetable/TimetableEditor';
import { AdminView } from './features/admin/AdminView';
import { VehiclesView } from './features/vehicles/VehiclesView';
import { MessagePopup } from './features/admin/MessagePopup';
import { canDispose, isAdmin, ROLE_LABELS, type User } from './domain/types';
import { hm } from './domain/time';
import { serverMode } from './data/supabase';
import { onSyncStatus, syncNow, type SyncStatus } from './data/sync';

type Tab = 'fahrt' | 'linien' | 'fahrplan' | 'fahrzeuge' | 'dienst' | 'auswertung' | 'admin';

const DISPO_TABS: [Tab, string][] = [['fahrt', 'Fahrt'], ['linien', 'Linien'], ['fahrplan', 'Fahrpläne'], ['fahrzeuge', 'Fahrzeuge'], ['dienst', 'Dienstplan'], ['auswertung', 'Auswertung']];
const ADMIN_TABS: [Tab, string][] = [...DISPO_TABS, ['admin', 'Administration']];
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
  const { user, logout, mustSetPassword } = useAuth();
  if (serverMode && mustSetPassword) return <SetPassword />;
  if (!user) return serverMode ? <EmailLogin /> : <Login />;
  const tabs = isAdmin(user) ? ADMIN_TABS : canDispose(user) ? DISPO_TABS : DRIVER_TABS;
  return <Shell tabs={tabs} user={user} onLogout={logout} />;
}

function Shell({ tabs, user, onLogout }: { tabs: [Tab, string][]; user: User; onLogout: () => void }) {
  const [tab, setTab] = useHashTab(tabs.map((t) => t[0]));
  const sim = useSim();
  const [account, setAccount] = useState(false);
  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="bar">
            <div className="brand"><b>DVZO-App</b><span>Oldtimerbetrieb DVZO</span></div>
            <span className="clock">{hm(sim.now)}</span>
            {sim.clock.sim && <span className="chip sim">Simulation {sim.clock.speed ? `${sim.clock.speed}×` : 'pausiert'}</span>}
            {serverMode && <SyncChip />}
            <button className="chip chipbtn" onClick={() => setAccount(true)} title="Konto und Passwort">{user.name}</button>
            <button className="btn sm ghost" onClick={onLogout}>Abmelden</button>
          </div>
          <nav className="tabs" aria-label="Bereiche">
            {tabs.map(([k, l]) => <button key={k} className={k === 'admin' ? 'right' : undefined} aria-current={k === tab ? 'page' : undefined} onClick={() => setTab(k)}>{l}</button>)}
          </nav>
        </div>
      </header>
      <main className="wrap">
        {tab === 'fahrt' && <DriveView />}
        {tab === 'linien' && <LinesEditor />}
        {tab === 'fahrplan' && <TimetableEditor />}
        {tab === 'fahrzeuge' && <VehiclesView />}
        {tab === 'dienst' && <DutyEditor />}
        {tab === 'auswertung' && <Reports />}
        {tab === 'admin' && <AdminView />}
      </main>
      {serverMode && <MessagePopup userId={user.id} />}
      {account && <AccountDialog user={user} onClose={() => setAccount(false)} />}
    </>
  );
}

function Login() {
  const users = useUsers();
  const { loginPin: login } = useAuth();
  const [sel, setSel] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const chosen = sel ?? users.find((u) => u.role === 'fahrer' && u.active !== false)?.id ?? users[0]?.id;
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
            {users.filter((u) => u.active !== false).map((u) => (
              <button type="button" key={u.id} className="ucard" aria-pressed={u.id === chosen} onClick={() => setSel(u.id)}>
                <b>{u.name}</b><span>{ROLE_LABELS[u.role]}</span>
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

function SyncChip() {
  const [s, setS] = useState<SyncStatus | null>(null);
  useEffect(() => onSyncStatus(setS), []);
  if (!s) return null;
  const text = !s.online ? `Offline${s.pending ? ` · ${s.pending} ausstehend` : ''}` : s.error ? 'Abgleich fehlgeschlagen' : s.pending ? `${s.pending} ausstehend` : 'Abgeglichen';
  const cls = !s.online || s.error ? 'chip warn' : s.pending ? 'chip sim' : 'chip ok';
  return (
    <button className={cls} style={{ border: 0, cursor: 'pointer' }} title={s.error || (s.lastSync ? `Zuletzt ${s.lastSync.toLocaleTimeString('de-CH')}` : '')} onClick={() => void syncNow()}>
      {text}
    </button>
  );
}

function EmailLogin() {
  const { loginEmail, sendReset } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="wrap">
      <div className="login">
        <div>
          <h1 className="title">DVZO-App</h1>
          <p className="note">Oldtimerbetrieb DVZO · Fahrgastzählung, Fahrpläne und Dienstpläne</p>
        </div>
        <form
          className="panel stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr((await loginEmail(email, pw)) ?? '');
            setBusy(false);
          }}
        >
          <h2 className="sec m0">Anmelden</h2>
          <label className="f">E-Mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="f">Passwort<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
          {err && <p className="warn-t">{err}</p>}
          {info && <p className="note">{info}</p>}
          <button className="btn pri big" type="submit" disabled={busy}>Anmelden</button>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              if (!email) return setErr('Bitte zuerst die E-Mail-Adresse eingeben.');
              const r = await sendReset(email);
              setErr(r ?? '');
              if (!r) setInfo('Wir haben dir einen Link zum Zurücksetzen geschickt.');
            }}
          >
            Passwort vergessen
          </button>
          <p className="note">Noch kein Konto? Die Disposition lädt dich per E-Mail ein.</p>
        </form>
      </div>
    </main>
  );
}

function SetPassword() {
  const { setPassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  return (
    <main className="wrap">
      <div className="login">
        <h1 className="title">Passwort festlegen</h1>
        <form
          className="panel stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < 8) return setErr('Mindestens 8 Zeichen.');
            if (pw !== pw2) return setErr('Die beiden Passwörter sind nicht gleich.');
            setErr((await setPassword(pw)) ?? '');
          }}
        >
          <label className="f">Neues Passwort<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="f">Wiederholen<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          {err && <p className="warn-t">{err}</p>}
          <button className="btn pri big" type="submit">Speichern</button>
        </form>
      </div>
    </main>
  );
}

function AccountDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { setPassword, logout } = useAuth();
  const [pw, setPw] = useState({ a: '', b: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.a.length < 8) return setErr('Das Passwort braucht mindestens 8 Zeichen.');
    if (pw.a !== pw.b) return setErr('Die beiden Eingaben stimmen nicht überein.');
    setBusy(true);
    const e = await setPassword(pw.a);
    setBusy(false);
    if (e) return setErr(e);
    toast('Passwort geändert');
    onClose();
  };
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel stack" role="dialog" aria-labelledby="acc-h">
        <div className="row spread"><h2 id="acc-h" className="sec m0">{user.name}</h2><button className="btn sm ghost" onClick={onClose}>Schliessen</button></div>
        <p className="note m0">Rolle: {ROLE_LABELS[user.role]}</p>
        {serverMode ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h3 className="m0">Passwort ändern</h3>
            <label className="f">Neues Passwort<input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></label>
            <label className="f">Neues Passwort wiederholen<input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></label>
            {err && <p className="warn-t">{err}</p>}
            <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Speichere …' : 'Passwort speichern'}</button>
          </form>
        ) : <p className="note">Im Testbetrieb ändert die Administration die PIN.</p>}
        <button className="btn ghost" onClick={() => { onClose(); logout(); }}>Abmelden</button>
      </div>
    </div>
  );
}
