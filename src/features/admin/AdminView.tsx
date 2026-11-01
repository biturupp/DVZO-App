import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { callAdmin, type AdminUser } from '../../data/adminApi';
import { db, uid } from '../../data/db';
import { useUsers } from '../../data/hooks';
import { lastSentByRecipient, sendMessage, type Message } from '../../data/messages';
import { serverMode } from '../../data/supabase';
import { ROLE_LABELS, type Role } from '../../domain/types';
import { toast } from '../../ui/toast';

const ROLES: Role[] = ['fahrer', 'dispo', 'admin'];
const ROLE_HELP: Record<Role, string> = {
  fahrer: 'Eigener Dienst, Fahrgastzählung, eigene Zählungen',
  dispo: 'Zusätzlich Linien, Fahrpläne, Dienstpläne und alle Auswertungen',
  admin: 'Alle Rechte inklusive Benutzerverwaltung',
};

const dt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

export function AdminView() {
  return (
    <div className="stack">
      {serverMode ? <ServerUsers /> : <LocalUsers />}
      <section className="panel stack">
        <h2 className="sec m0">Rollen</h2>
        <div className="tbl">
          <table>
            <tbody>{ROLES.map((r) => <tr key={r}><td><b>{ROLE_LABELS[r]}</b></td><td>{ROLE_HELP[r]}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------- Serverbetrieb (Supabase) ---------- */

function ServerUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [delArm, setDelArm] = useState<string | null>(null);
  const [compose, setCompose] = useState<AdminUser[] | null>(null);
  const [sent, setSent] = useState<Map<string, Message>>(new Map());
  const [nu, setNu] = useState({ name: '', email: '', role: 'fahrer' as Role });

  const load = useCallback(async () => {
    try {
      const r = await callAdmin({ action: 'list' });
      setUsers(r.users ?? []);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  const loadSent = useCallback(() => { lastSentByRecipient().then(setSent).catch(() => {}); }, []);

  useEffect(() => {
    void load();
    loadSent();
    const t = setInterval(loadSent, 15_000);
    return () => clearInterval(t);
  }, [load, loadSent]);

  const run = async (key: string, fn: () => Promise<{ note?: string; user?: AdminUser }>) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.note) toast(r.note);
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = () => {
    if (!nu.name.trim()) return toast('Bitte einen Namen eingeben');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nu.email.trim())) return toast('Bitte eine gültige E-Mail-Adresse eingeben');
    void run('new', async () => {
      const r = await callAdmin({ action: 'create', name: nu.name, email: nu.email, role: nu.role });
      setNu({ name: '', email: '', role: nu.role });
      return r;
    });
  };

  const active = (users ?? []).filter((u) => u.active);
  return (
    <section className="panel stack">
      <div className="row spread">
        <h2 className="sec m0">Benutzerverwaltung</h2>
        <div className="row">
          {active.length > 1 && <button className="btn sm" onClick={() => setCompose(active.filter((u) => u.id !== me?.id))}>Nachricht an alle</button>}
          <button className="btn sm ghost" onClick={() => { void load(); loadSent(); }}>Aktualisieren</button>
        </div>
      </div>
      {err && <p className="warn-t">{err}</p>}
      {!users && !err && <p className="note">Lade Benutzer …</p>}
      {users && (
        <div className="tbl">
          <table>
            <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Letzte Nachricht</th><th /></tr></thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me?.id;
                const last = sent.get(u.id);
                return (
                  <tr key={u.id} className="ucard-row">
                    <td><b>{u.name}</b>{self && <span className="note"> (du)</span>}</td>
                    <td className="nowrap">{u.email}</td>
                    <td>
                      <select aria-label={`Rolle von ${u.name}`} value={u.role} disabled={self || !u.active || busy === u.id}
                        onChange={(e) => void run(u.id, () => callAdmin({ action: 'update', id: u.id, role: e.target.value as Role }))}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td className="nowrap">
                      {!u.active ? <span className="status-off">Gesperrt</span>
                        : u.confirmed ? <><span className="status-ok">Aktiv</span>{u.lastSignIn && <div className="note">zuletzt {dt(u.lastSignIn)}</div>}</>
                        : <><span className="status-wait">Eingeladen</span>{u.invitedAt && <div className="note">{dt(u.invitedAt)}</div>}</>}
                    </td>
                    <td className="note">{last ? <>{dt(last.createdAt)} · {last.readAt ? <span className="status-ok">gelesen</span> : <span className="status-wait">ungelesen</span>}</> : '–'}</td>
                    <td className="nowrap">
                      {u.active && !self && <>
                        <button className="btn sm" disabled={busy === u.id} onClick={() => void run(u.id, () => callAdmin({ action: 'invite', id: u.id }))}>
                          {u.confirmed ? 'Passwort-Link senden' : 'Einladung senden'}
                        </button>{' '}
                        <button className="btn sm" onClick={() => setCompose([u])}>Nachricht</button>{' '}
                        <button className={`btn sm${delArm === u.id ? ' danger' : ''}`} disabled={busy === u.id}
                          onClick={() => {
                            if (delArm !== u.id) { setDelArm(u.id); setTimeout(() => setDelArm((d) => (d === u.id ? null : d)), 4000); return; }
                            setDelArm(null);
                            void run(u.id, () => callAdmin({ action: 'delete', id: u.id }));
                          }}>{delArm === u.id ? 'Wirklich löschen?' : 'Löschen'}</button>
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel stack inset">
        <h3 className="m0">Neuen Benutzer anlegen</h3>
        <div className="row">
          <label className="f grow1">Name<input type="text" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="Vorname Nachname" /></label>
          <label className="f grow2">E-Mail (Benutzername)<input type="email" autoComplete="off" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} placeholder="name@beispiel.ch" /></label>
          <label className="f">Rolle
            <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <button className="btn pri" disabled={busy === 'new'} onClick={create}>{busy === 'new' ? 'Sende …' : 'Anlegen und einladen'}</button>
        </div>
        <p className="note m0">Die Person erhält eine E-Mail mit einem Link. Darüber legt sie ihr Passwort selbst fest; ihr Benutzername ist die E-Mail-Adresse. Wer schon Dienste oder Zählungen hat, wird beim Löschen gesperrt statt gelöscht, damit die Auswertungen erhalten bleiben.</p>
      </div>
      {compose && <ComposeDialog to={compose} onClose={(ok) => { setCompose(null); if (ok) loadSent(); }} />}
    </section>
  );
}

function ComposeDialog({ to, onClose }: { to: AdminUser[]; onClose: (sent: boolean) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await sendMessage(to.map((u) => u.id), text.trim());
      toast(to.length === 1 ? `Nachricht an ${to[0].name} gesendet` : `Nachricht an ${to.length} Personen gesendet`);
      onClose(true);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className="panel stack" role="dialog" aria-labelledby="compose-h">
        <h2 id="compose-h" className="sec m0">Nachricht an {to.length === 1 ? to[0].name : `alle (${to.length})`}</h2>
        <p className="note m0">Erscheint sofort als Popup auf dem Bildschirm, sonst beim nächsten Öffnen der App.</p>
        <textarea rows={4} maxLength={1000} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Kurs 5 fällt heute aus, bitte in Bauma warten." />
        <div className="row">
          <button className="btn pri" disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? 'Sende …' : 'Senden'}</button>
          <button className="btn ghost" onClick={() => onClose(false)}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Lokaler Testbetrieb (PIN) ---------- */

function LocalUsers() {
  const users = useUsers();
  const { user: me } = useAuth();
  const [nu, setNu] = useState({ name: '', pin: '', role: 'fahrer' as Role });
  const [delArm, setDelArm] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (delArm !== id) { setDelArm(id); return; }
    setDelArm(null);
    const used = (await db.duties.where('driverId').equals(id).count()) > 0;
    if (used) { await db.users.update(id, { active: false }); toast('Hat bereits Dienste und wurde deshalb gesperrt statt gelöscht'); }
    else { await db.users.delete(id); toast('Gelöscht'); }
  };

  return (
    <section className="panel stack">
      <h2 className="sec m0">Benutzerverwaltung</h2>
      <p className="note m0">Testbetrieb ohne Server: Anmeldung mit PIN. Einladungen per E-Mail und Sofortnachrichten gibt es nur im Serverbetrieb.</p>
      <div className="tbl">
        <table>
          <thead><tr><th>Name</th><th>Rolle</th><th>PIN</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="ucard-row">
                <td><b>{u.name}</b>{u.id === me?.id && <span className="note"> (du)</span>}</td>
                <td>
                  <select aria-label={`Rolle von ${u.name}`} value={u.role} disabled={u.id === me?.id} onChange={(e) => void db.users.update(u.id, { role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="mono">{u.pin}</td>
                <td>{u.active === false ? <span className="status-off">Gesperrt</span> : <span className="status-ok">Aktiv</span>}</td>
                <td>{u.id !== me?.id && u.active !== false && (
                  <button className={`btn sm${delArm === u.id ? ' danger' : ''}`} onClick={() => void remove(u.id)}>{delArm === u.id ? 'Wirklich löschen?' : 'Löschen'}</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <label className="f grow1">Name<input type="text" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label>
        <label className="f">PIN<input type="text" inputMode="numeric" className="w-num" value={nu.pin} onChange={(e) => setNu({ ...nu, pin: e.target.value })} /></label>
        <label className="f">Rolle
          <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        <button className="btn" onClick={async () => {
          if (!nu.name.trim() || !/^\d{4}$/.test(nu.pin)) return toast('Name und 4-stellige PIN eingeben');
          await db.users.add({ id: uid('u'), name: nu.name.trim(), role: nu.role, pin: nu.pin, active: true });
          toast(`${nu.name.trim()} angelegt`);
          setNu({ name: '', pin: '', role: nu.role });
        }}>Anlegen</button>
      </div>
    </section>
  );
}
