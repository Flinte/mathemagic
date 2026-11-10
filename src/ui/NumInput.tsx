import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { keypad, useKeypad, type Key } from './keypadStore';

export interface NumInputHandle { focus: () => void; }

interface Props {
  value: string;
  onChange: (value: string) => void;
  // Mit ✓ bestaetigen. Ohne onSubmit pruefen die Spiele selbst bei jeder Eingabe.
  onSubmit?: () => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  allowComma?: boolean;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<NumInputHandle>;
}

let nextId = 1;

// Zahlenfeld ohne Handy-Tastatur. Nach aussen verhaelt es sich wie ein
// <input>: value, onChange, focus(). Eingetippt wird ueber den gezeichneten
// Ziffernblock oder eine echte Tastatur — die Handy-Tastatur schob beim
// Aufklappen jedes Mal das ganze Bild nach oben.
export const NumInput = ({
  value, onChange, onSubmit, readOnly = false, autoFocus = false, allowComma = false,
  maxLength = 5, className = '', style, ref,
}: Props) => {
  const [id] = useState(() => nextId++);
  const { activeId } = useKeypad();

  // Neueste Props fuer die Tasten-Verarbeitung. `pending` faengt Tastendruecke
  // ab, die schneller kommen, als React neu zeichnet. useLayoutEffect statt
  // useEffect: laeuft direkt nach dem Zeichnen, sonst sieht ✓ in einem
  // gedrosselten Tab noch die Werte von vorher.
  const latest = useRef({ onChange, onSubmit, readOnly, allowComma, maxLength });
  const pending = useRef(value);
  useLayoutEffect(() => {
    latest.current = { onChange, onSubmit, readOnly, allowComma, maxLength };
    pending.current = value;
  });

  // Liest nur Refs — bleibt ueber alle Renders gueltig.
  const press = useRef((key: Key) => {
    const p = latest.current;
    // ✓ geht immer durch — nach dem Aufloesen bedeutet es "weiter".
    if (key === 'enter') { p.onSubmit?.(); return; }
    if (p.readOnly) return;
    const v = pending.current;
    let next = v;
    if (key === 'back') next = v.slice(0, -1);
    else if (key === ',') { if (p.allowComma && !v.includes(',')) next = (v || '0') + ','; }
    else if (v.length < p.maxLength) next = v + key;
    if (next !== v) { pending.current = next; p.onChange(next); }
  }).current;

  const field = { id, press, canFocus: () => !latest.current.readOnly, comma: allowComma, submit: !!onSubmit };

  useEffect(() => {
    keypad.register(field);
    if (autoFocus) keypad.focus(id);
    return () => keypad.unregister(id);
    // Anmelden genau einmal; Aenderungen an Komma/✓ meldet der Effekt darunter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => keypad.update(field), [allowComma, !!onSubmit]);

  useImperativeHandle(ref, () => ({ focus: () => keypad.focus(id) }), [id]);

  const active = activeId === id && !readOnly;
  return (
    <span
      role="textbox"
      aria-readonly={readOnly}
      className={`num-input ${className} ${active ? 'num-active' : ''}`}
      style={style}
      onClick={() => keypad.focus(id)}
    >
      {value}
      {active && <span className="num-caret" />}
    </span>
  );
};
