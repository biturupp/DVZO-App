import { useState } from 'react';
import { db, uid } from '../../data/db';
import { useCalendars, useTrips } from '../../data/hooks';
import { describe, holidays, serviceDates, WEEKDAY_LABELS } from '../../domain/calendar';
import type { DateRange, HolidayRule, ServiceCalendar } from '../../domain/types';
import { toast } from '../../ui/toast';
import { DateInput } from '../../ui/DateInput';

const fmt = (s: string) => s.split('-').reverse().join('.');
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Fahrtage nach Monat gruppieren: [[«Mai 2027», [«So 2.», …]], …]. */
function byMonth(dates: string[]): [string, string[]][] {
  const out = new Map<string, string[]>();
  for (const d of dates) {
    const key = `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
    const wd = (new Date(d + 'T12:00').getDay() + 6) % 7;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(`${WD_SHORT[wd]} ${Number(d.slice(8))}.`);
  }
  return [...out];
}
const HOLIDAY_RULES: [HolidayRule, string][] = [
  ['normal', 'wie gewöhnlicher Wochentag'],
  ['sunday', 'wie Sonntag'],
  ['never', 'nie (kein Betrieb)'],
  ['only', 'nur an Feiertagen'],
];

function emptyCalendar(): ServiceCalendar {
  const y = new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0);
  return { id: uid('k'), name: '', from: `${y}-01-01`, to: `${y}-12-31`, weekdays: [1, 2, 3, 4, 5], holidays: 'never', extraDates: [], exceptions: [] };
}

/** Fahrtag-Intervalle: Vorlagen für die Verkehrstage von Kursen. */
export function CalendarPanel() {
  const calendars = useCalendars();
  const trips = useTrips();
  const [edit, setEdit] = useState<ServiceCalendar | null>(null);
  const [delArm, setDelArm] = useState<string | null>(null);

  const remove = async (c: ServiceCalendar) => {
    if (delArm !== c.id) {
      setDelArm(c.id);
      setTimeout(() => setDelArm((x) => (x === c.id ? null : x)), 5000);
      return;
    }
    const users = trips.filter((t) => t.calendarId === c.id);
    for (const t of users) await db.trips.update(t.id, { calendarId: null });
    await db.calendars.delete(c.id);
    setDelArm(null);
    toast(`«${c.name}» gelöscht${users.length ? `, ${users.length} Kurse verkehren jetzt täglich` : ''}`);
  };

  return (
    <section className="panel stack">
      <div className="row spread">
        <h2 className="sec m0">Fahrtag-Intervalle</h2>
        <button className="btn pri" onClick={() => setEdit(emptyCalendar())}>+ Neues Intervall</button>
      </div>
      <p className="note">Ein Intervall legt fest, an welchen Tagen eines Jahres ein Kurs verkehrt. Es wird einmal gespeichert und dann beliebig vielen Kursen auf allen Linien zugeordnet.</p>
      {calendars.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>Name</th><th>Verkehrt</th><th className="num">Fahrtage</th><th className="num">Kurse</th><th /></tr></thead>
            <tbody>
              {calendars.map((c) => {
                const n = trips.filter((t) => t.calendarId === c.id).length;
                return (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td className="note">{describe(c)}</td>
                    <td className="num">{serviceDates(c).length}</td>
                    <td className="num">{n}</td>
                    <td className="nowrap">
                      <button className="btn sm" onClick={() => setEdit({ ...c })}>Bearbeiten</button>{' '}
                      <button className="btn sm" onClick={() => setEdit({ ...c, id: uid('k'), name: `${c.name} (Kopie)` })}>Kopieren</button>{' '}
                      <button className={`btn sm${delArm === c.id ? ' danger' : ''}`} onClick={() => remove(c)}>
                        {delArm === c.id ? (n ? `Löschen? ${n} Kurse verkehren dann täglich` : 'Wirklich löschen?') : 'Löschen'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="empty">Noch keine Intervalle. Ohne Intervall verkehrt ein Kurs täglich.</p>}
      {edit && <CalendarForm key={edit.id} cal={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function CalendarForm({ cal, onClose }: { cal: ServiceCalendar; onClose: () => void }) {
  const [c, setC] = useState<ServiceCalendar>(cal);
  const [exc, setExc] = useState<DateRange>({ from: '', to: '' });
  const [extra, setExtra] = useState('');
  const set = (patch: Partial<ServiceCalendar>) => setC({ ...c, ...patch });
  const toggleDay = (d: number) => set({ weekdays: c.weekdays.includes(d) ? c.weekdays.filter((x) => x !== d) : [...c.weekdays, d].sort() });
  const lastExc = c.exceptions.length ? c.exceptions[c.exceptions.length - 1].to : '';
  const dates = c.from && c.to && c.from <= c.to ? serviceDates(c) : [];
  const hol = [...new Set([Number(c.from.slice(0, 4)), Number(c.to.slice(0, 4))])].flatMap((y) => [...holidays(y)].filter(([d]) => d >= c.from && d <= c.to));

  const save = async () => {
    if (!c.name.trim()) return toast('Bitte einen Namen eingeben, z. B. «Sonntage Mai–Okt.»');
    if (!c.from || !c.to || c.from > c.to) return toast('Der Zeitraum ist ungültig');
    await db.calendars.put({ ...c, name: c.name.trim() });
    toast(`«${c.name.trim()}» gespeichert`);
    onClose();
  };

  return (
    <div className="panel stack inset">
      <h3 className="m0">Intervall {cal.name ? `«${cal.name}»` : 'erstellen'}</h3>
      <div className="row">
        <label className="f grow2">Name<input type="text" value={c.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Sonntage Mai–Okt. ohne Sommerferien" /></label>
        <label className="f">Von<DateInput value={c.from} onChange={(v) => set({ from: v })} defaultMonth={c.to || undefined} /></label>
        <label className="f">Bis<DateInput value={c.to} onChange={(v) => set({ to: v })} defaultMonth={c.from || undefined} /></label>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="flabel">Wochentage</span>
        <div className="row" style={{ gap: 6 }}>
          {WEEKDAY_LABELS.map((l, i) => (
            <button key={l} type="button" className={`btn sm day${c.weekdays.includes(i + 1) ? ' pri' : ''}`} aria-pressed={c.weekdays.includes(i + 1)} onClick={() => toggleDay(i + 1)}>{l}</button>
          ))}
          <span className="note">Schnellwahl:</span>
          <button type="button" className="btn sm ghost" onClick={() => set({ weekdays: [1, 2, 3, 4, 5] })}>Mo–Fr</button>
          <button type="button" className="btn sm ghost" onClick={() => set({ weekdays: [6] })}>Sa</button>
          <button type="button" className="btn sm ghost" onClick={() => set({ weekdays: [7] })}>So</button>
          <button type="button" className="btn sm ghost" onClick={() => set({ weekdays: [6, 7] })}>Sa+So</button>
          <button type="button" className="btn sm ghost" onClick={() => set({ weekdays: [1, 2, 3, 4, 5, 6, 7] })}>täglich</button>
        </div>
      </div>
      <label className="f" style={{ maxWidth: 320 }}>
        Allgemeine Feiertage
        <select value={c.holidays} onChange={(e) => set({ holidays: e.target.value as HolidayRule })}>
          {HOLIDAY_RULES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <div className="grid2">
        <div className="stack" style={{ gap: 6 }}>
          <span className="flabel">Ausnahmen (kein Betrieb)</span>
          {c.exceptions.map((r, i) => (
            <div key={i} className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span className="mono">{r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`}</span>
              <button type="button" className="btn sm" aria-label="Ausnahme entfernen" onClick={() => set({ exceptions: c.exceptions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <div className="row" style={{ gap: 6 }}>
            <label className="f">Von<DateInput value={exc.from} onChange={(v) => setExc({ from: v, to: exc.to || v })} defaultMonth={lastExc || c.from || undefined} /></label>
            <label className="f">Bis<DateInput value={exc.to} onChange={(v) => setExc({ ...exc, to: v })} defaultMonth={exc.from || lastExc || c.from || undefined} /></label>
            <button type="button" className="btn" onClick={() => {
              if (!exc.from) return toast('Mindestens «Von» angeben');
              const r = { from: exc.from, to: exc.to && exc.to >= exc.from ? exc.to : exc.from };
              set({ exceptions: [...c.exceptions, r].sort((a, b) => a.from.localeCompare(b.from)) });
              setExc({ from: '', to: '' });
            }}>Ausnahme hinzufügen</button>
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="flabel">Zusätzliche Fahrtage</span>
          {c.extraDates.map((d) => (
            <div key={d} className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span className="mono">{fmt(d)}</span>
              <button type="button" className="btn sm" aria-label="Fahrtag entfernen" onClick={() => set({ extraDates: c.extraDates.filter((x) => x !== d) })}>✕</button>
            </div>
          ))}
          <div className="row" style={{ gap: 6 }}>
            <label className="f">Datum<DateInput value={extra} onChange={setExtra} defaultMonth={c.extraDates[c.extraDates.length - 1] || c.from || undefined} /></label>
            <button type="button" className="btn" onClick={() => {
              if (!extra) return;
              if (!c.extraDates.includes(extra)) set({ extraDates: [...c.extraDates, extra].sort() });
              setExtra('');
            }}>Fahrtag hinzufügen</button>
          </div>
        </div>
      </div>
      <div className="preview">
        <b>{dates.length} Fahrtage</b>
        {dates.length > 0 && (
          <div className="preview-list">
            {byMonth(dates).map(([m, ds]) => (
              <div key={m} className="preview-month"><b>{m}</b> <span className="note">({ds.length})</span><span className="days">{ds.join('  ')}</span></div>
            ))}
          </div>
        )}
        {hol.length > 0 && <div className="note">Feiertage im Zeitraum: {hol.map(([d, n]) => `${n} ${fmt(d).slice(0, 6)}`).join(', ')}</div>}
      </div>
      <div className="row">
        <button className="btn pri" onClick={save}>Intervall speichern</button>
        <button className="btn ghost" onClick={onClose}>Abbrechen</button>
      </div>
    </div>
  );
}
