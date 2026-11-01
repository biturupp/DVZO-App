import { useEffect, useState } from 'react';
import { normalizeTime } from '../domain/time';

interface Props {
  /** «HH:MM» oder leer. */
  value: string;
  /** Wird beim Verlassen des Feldes (oder Enter) mit gültiger Zeit «HH:MM» aufgerufen, bei leerem Feld mit ''. */
  onCommit: (value: string) => void;
  'aria-label'?: string;
  allowEmpty?: boolean;
  className?: string;
}

/**
 * Uhrzeit-Feld, immer im 24-Stunden-Format, unabhängig von der Spracheinstellung des Geräts.
 * Eingaben wie «830», «8.30» oder «0830» werden zu «08:30».
 */
export function TimeInput({ value, onCommit, allowEmpty, className, ...rest }: Props) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);

  const commit = () => {
    if (!text.trim() && allowEmpty) {
      setInvalid(false);
      if (value !== '') onCommit('');
      return;
    }
    const v = normalizeTime(text);
    if (!v) {
      setInvalid(true);
      setText(value);
      setTimeout(() => setInvalid(false), 1500);
      return;
    }
    setText(v);
    if (v !== value) onCommit(v);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="hh:mm"
      maxLength={5}
      className={`time24${invalid ? ' invalid' : ''}${className ? ' ' + className : ''}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onFocus={(e) => e.target.select()}
      {...rest}
    />
  );
}
