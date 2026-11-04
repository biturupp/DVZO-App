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
import { Dashboard } from './features/dashboard/Dashboard';
import { DriveProvider } from './features/drive/DriveContext';
import { Icon, type IconName } from './ui/icons';
import { canDispose, isAdmin, ROLE_LABELS, type User } from './domain/types';
import { hm } from './domain/time';
import { serverMode } from './data/supabase';
import { onSyncStatus, syncNow, type SyncStatus } from './data/sync';

type Tab = 'dashboard' | 'fahrt' | 'linien' | 'fahrplan' | 'fahrzeuge' | 'dienst' | 'auswertung' | 'admin';
type NavItem = { tab: Tab; label: string; icon: IconName };

const DASH: NavItem = { tab: 'dashboard', label: 'Dashboard', icon: 'dashboard' };
const COUNT: NavItem = { tab: 'fahrt', label: 'Frequenz', icon: 'people' };
const DISPO_NAV: NavItem[] = [
  DASH, COUNT,
  { tab: 'linien', label: 'Linien', icon: 'lines' },
  { tab: 'fahrplan', label: 'Fahrpläne', icon: 'calendar' },
  { tab: 'fahrzeuge', label: 'Fahrzeuge', icon: 'vehicle' },
  { tab: 'dienst', label: 'Dienstplan', icon: 'duty' },
  { tab: 'auswertung', label: 'Auswertung', icon: 'chart' },
];
const ADMIN_NAV: NavItem[] = [...DISPO_NAV, { tab: 'admin', label: 'Admin', icon: 'admin' }];
const DRIVER_NAV: NavItem[] = [DASH, COUNT, { tab: 'auswertung', label: 'Meine Zählungen', icon: 'chart' }];

const TITLES: Record<Tab, string> = {
  dashboard: 'Dashboard', fahrt: 'Frequenz erfassen', linien: 'Linien', fahrplan: 'Fahrpläne', fahrzeuge: 'Fahrzeuge',
  dienst: 'Dienstplan', auswertung: 'Auswertung', admin: 'Administration',
};

function useHashTab(allowed: Tab[]): [Tab, (t: Tab) => void] {
  const read = () => { const h = location.hash.slice(1) as Tab; return allowed.includes(h) ? h : 'dashboard'; };
  const [tab, setTab] = useState<Tab>(read);
  useEffect(() => {
    const on = () => setTab(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  });
  return [allowed.includes(tab) ? tab : 'dashboard', (t) => { location.hash = t; setTab(t); }];
}

export function App() {
  const { user, logout, mustSetPassword } = useAuth();
  if (serverMode && mustSetPassword) return <SetPassword />;
  if (!user) return serverMode ? <EmailLogin /> : <Login />;
  const nav = isAdmin(user) ? ADMIN_NAV : canDispose(user) ? DISPO_NAV : DRIVER_NAV;
  return (
    <DriveProvider>
      <Shell nav={nav} user={user} onLogout={logout} />
    </DriveProvider>
  );
}

function Shell({ nav, user, onLogout }: { nav: NavItem[]; user: User; onLogout: () => void }) {
  const [tab, setTab] = useHashTab(nav.map((n) => n.tab));
  const sim = useSim();
  const [account, setAccount] = useState(false);
  const [menu, setMenu] = useState(false);
  const go = (t: Tab) => { setTab(t); setMenu(false); scrollTo(0, 0); };
  const main = nav.filter((n) => n.tab !== 'admin');
  const admin = nav.find((n) => n.tab === 'admin');
  const link = (n: NavItem) => (
    <button key={n.tab} className="rail-item" aria-current={n.tab === tab ? 'page' : undefined} onClick={() => go(n.tab)}>
      <Icon name={n.icon} size={26} />
      <span>{n.label}</span>
    </button>
  );
  return (
    <div className="app">
      <nav className="rail" aria-label="Menü">
        <img className="rail-logo" src={`${import.meta.env.BASE_URL}dvzo-logo.png`} alt="DVZO" />
        {main.map(link)}
        <div className="rail-end">
          {admin && link(admin)}
          <button className="rail-item" onClick={() => setAccount(true)} title="Konto und Passwort">
            <Icon name="user" size={26} />
            <span>{user.name.split(' ')[0]}</span>
          </button>
        </div>
      </nav>
      <div className="app-main">
        {tab !== 'dashboard' && (
          <header className="pagebar">
            <button className="menubtn" onClick={() => setMenu(true)} aria-label="Menü öffnen"><Icon name="menu" size={26} /></button>
            <img className="pagebar-logo" src={`${import.meta.env.BASE_URL}dvzo-logo.png`} alt="DVZO" />
            <h1>{TITLES[tab]}</h1>
            {sim.clock.sim && <span className="chip sim">Simulation {sim.clock.speed ? `${sim.clock.speed}×` : 'pausiert'}</span>}
            {serverMode && <SyncChip />}
            <span className="clock">{hm(sim.now)}</span>
          </header>
        )}
        <main className={tab === 'dashboard' ? 'main-dash' : 'main-page'}>
          {tab === 'dashboard' && <Dashboard onCount={() => go('fahrt')} onMenu={() => setMenu(true)} syncChip={serverMode ? <SyncChip /> : null} />}
          {tab === 'fahrt' && <DriveView />}
          {tab === 'linien' && <LinesEditor />}
          {tab === 'fahrplan' && <TimetableEditor />}
          {tab === 'fahrzeuge' && <VehiclesView />}
          {tab === 'dienst' && <DutyEditor />}
          {tab === 'auswertung' && <Reports />}
          {tab === 'admin' && <AdminView />}
        </main>
      </div>
      {menu && (
        <div className="overlay drawer-wrap" onClick={(e) => { if (e.target === e.currentTarget) setMenu(false); }}>
          <nav className="drawer" aria-label="Menü">
            <div className="drawer-head">
              <img src={`${import.meta.env.BASE_URL}dvzo-logo.png`} alt="DVZO" />
              <button className="btn sm ghost" onClick={() => setMenu(false)}>Schliessen</button>
            </div>
            {nav.map((n) => (
              <button key={n.tab} className="drawer-item" aria-current={n.tab === tab ? 'page' : undefined} onClick={() => go(n.tab)}>
                <Icon name={n.icon} />{n.tab === 'admin' ? 'Administration' : n.label}
              </button>
            ))}
            <hr />
            <button className="drawer-item" onClick={() => { setMenu(false); setAccount(true); }}><Icon name="user" />Mein Konto ({user.name})</button>
            <button className="drawer-item" onClick={() => { setMenu(false); onLogout(); }}>Abmelden</button>
          </nav>
        </div>
      )}
      {serverMode && <MessagePopup userId={user.id} />}
      {account && <AccountDialog user={user} onClose={() => setAccount(false)} />}
    </div>
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
          <img className="login-logo" src={`${import.meta.env.BASE_URL}dvzo-logo.png`} alt="DVZO" />
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
          <img className="login-logo" src={`${import.meta.env.BASE_URL}dvzo-logo.png`} alt="DVZO" />
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
