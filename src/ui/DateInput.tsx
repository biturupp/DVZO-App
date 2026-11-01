import { useEffect, useRef, useState } from 'react';
import { fmtDate, isoDate, parseDate } from '../domain/time';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const LAST_KEY = 'dvzo.lastDate';

/** Zuletzt gewähltes Datum (für den Startmonat leerer Felder). */
function lastPicked(): string {
  try { return localStorage.getItem(LAST_KEY) ?? ''; } catch { return ''; }
}
function remember(iso: string) {
  try { localStorage.setItem(LAST_KEY, iso); } catch { /* egal */ }
}

interface Props {
  /** ISO «JJJJ-MM-TT» oder leer. */
  value: string;
  onChange: (iso: string) => void;
  /** Monat, den der Kalender bei leerem Feld zeigt (ISO-Datum). Sonst der zuletzt gewählte Monat. */
  defaultMonth?: string;
  allowEmpty?: boolean;
  'aria-label'?: string;
}

/**
 * Datumsfeld im Format TT.MM.JJJJ mit eigenem Kalender (Woche ab Montag),
 * unabhängig von der Spracheinstellung des Geräts.
 */
export function DateInput({ value, onChange, defaultMonth, allowEmpty = true, ...rest }: Props) {
  const [text, setText] = useState(fmtDate(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState({ y: 0, m: 0 });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setText(fmtDate(value)); setInvalid(false); }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (iso: string) => {
    remember(iso);
    setText(fmtDate(iso));
    setOpen(false);
    if (iso !== value) onChange(iso);
  };

  const commit = () => {
    if (!text.trim()) {
      if (allowEmpty && value) onChange('');
      else setText(fmtDate(value));
      return;
    }
    const ref = Number((value || defaultMonth || lastPicked() || isoDate(new Date())).slice(0, 4));
    const iso = parseDate(text, ref);
    if (!iso) {
      setInvalid(true);
      setText(fmtDate(value));
      setTimeout(() => setInvalid(false), 1500);
      return;
    }
    pick(iso);
  };

  const toggle = () => {
    if (open) return setOpen(false);
    const start = value || defaultMonth || lastPicked() || isoDate(new Date());
    setMonth({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
    setOpen(true);
  };

  const shift = (d: number) => setMonth(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });

  const first = new Date(month.y, month.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const today = isoDate(new Date());
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDate(new Date(month.y, month.m, i + 1)))];

  return (
    <div className="dateinput" ref={box}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="TT.MM.JJJJ"
        maxLength={10}
        className={`date24${invalid ? ' invalid' : ''}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        {...rest}
      />
      <button type="button" className="btn sm calbtn" aria-label="Kalender öffnen" aria-expanded={open} onClick={toggle}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3" width="13" height="11.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      {open && (
        <div className="calpop" role="dialog" aria-label="Datum wählen">
          <div className="calhead">
            <button type="button" className="btn sm ghost" aria-label="Ein Jahr zurück" onClick={() => shift(-12)}>«</button>
            <button type="button" className="btn sm ghost" aria-label="Monat zurück" onClick={() => shift(-1)}>‹</button>
            <b>{MONTHS[month.m]} {month.y}</b>
            <button type="button" className="btn sm ghost" aria-label="Monat vor" onClick={() => shift(1)}>›</button>
            <button type="button" className="btn sm ghost" aria-label="Ein Jahr vor" onClick={() => shift(12)}>»</button>
          </div>
          <div className="calgrid">
            {WD.map((w) => <span key={w} className="calwd">{w}</span>)}
            {cells.map((iso, i) => iso ? (
              <button
                key={iso}
                type="button"
                className={`calday${iso === value ? ' sel' : ''}${iso === today ? ' today' : ''}${i % 7 >= 5 ? ' we' : ''}`}
                onClick={() => pick(iso)}
              >{Number(iso.slice(8))}</button>
            ) : <span key={`e${i}`} />)}
          </div>
        </div>
      )}
    </div>
  );
}
