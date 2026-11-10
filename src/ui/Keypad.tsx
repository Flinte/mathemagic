import { useEffect, type ReactNode } from 'react';
import { Delete } from 'lucide-react';
import { keypad, useKeypad, type Key } from './keypadStore';

// Der gezeichnete Ziffernblock. Er erscheint, sobald ein Zahlenfeld auf dem
// Bildschirm ist: hochkant unten, quer als Spalte rechts. Die Spielseite
// bekommt per Klasse am <body> genau so viel Platz frei, dass nichts verdeckt wird.
export const Keypad = () => {
  const { visible, comma, submit } = useKeypad();

  // Mit Komma und ✓ hat der Block eine fuenfte Reihe — die Seite muss mehr Platz lassen.
  useEffect(() => { document.documentElement.style.setProperty('--kp-rows', comma && submit ? '5' : '4'); }, [comma, submit]);

  useEffect(() => {
    document.body.classList.toggle('with-keypad', visible);
    if (!visible) return;
    // Echte Tastatur (Computer, Tablet mit Tastatur) geht denselben Weg.
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let k: Key | null = null;
      if (/^[0-9]$/.test(e.key)) k = e.key as Key;
      else if (e.key === 'Backspace') k = 'back';
      else if (e.key === 'Enter') k = 'enter';
      else if (e.key === ',' || e.key === '.') k = ',';
      if (!k) return;
      e.preventDefault();
      keypad.press(k);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('with-keypad'); };
  }, [visible]);

  if (!visible) return null;

  const btn = (k: Key, label: ReactNode, cls = '') => (
    <button
      key={k}
      className={`kp-key ${cls}`}
      // pointerdown statt click: reagiert sofort, und der Knopf nimmt dem
      // Zahlenfeld nicht den Fokus weg.
      onPointerDown={e => { e.preventDefault(); keypad.press(k); }}
      onClick={e => { if (e.detail === 0) keypad.press(k); }}   // Bedienung per Tastatur/Screenreader
      aria-label={k === 'back' ? 'Löschen' : k === 'enter' ? 'Fertig' : undefined}
    >
      {label}
    </button>
  );

  const back = btn('back', <Delete size={26} />, 'kp-back');
  const last = comma && submit
    ? [btn(',', ','), btn('0', '0'), back]
    : [back, btn('0', '0'), submit ? btn('enter', '✓', 'kp-enter') : comma ? btn(',', ',') : <span key="gap" />];

  return (
    <div className="keypad" role="group" aria-label="Ziffernblock">
      {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as Key[]).map(k => btn(k, k))}
      {last}
      {comma && submit && btn('enter', '✓', 'kp-enter kp-wide')}
    </div>
  );
};
