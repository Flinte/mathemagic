import { useSyncExternalStore } from 'react';

// Der Ziffernblock und die Zahlenfelder sprechen ueber diesen kleinen Speicher
// miteinander: Jedes Feld meldet sich an, eines davon ist aktiv, und jeder
// Tastendruck — vom gezeichneten Block oder von einer echten Tastatur — geht an
// das aktive Feld.

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back' | 'enter';

export interface Field {
  id: number;
  press: (key: Key) => void;
  canFocus: () => boolean;   // schreibgeschuetzte Felder nehmen keinen Fokus
  comma: boolean;            // Komma-Taste anbieten (Geld)
  submit: boolean;           // ✓-Taste anbieten
}

let fields: Field[] = [];
let active: Field | null = null;
// Ein Feld, das sich ab- und gleich wieder anmeldet (React tut das im
// Entwicklungsmodus mit jedem neuen Feld), behaelt seinen Fokus.
let lastActiveId = -1;
let snapshot = { visible: false, activeId: -1, comma: false, submit: false };
const listeners = new Set<() => void>();

const emit = () => {
  snapshot = {
    visible: fields.length > 0,
    activeId: active?.id ?? -1,
    comma: !!active?.comma,
    submit: !!active?.submit,
  };
  listeners.forEach(l => l());
};

export const keypad = {
  register(f: Field) {
    fields.push(f);
    // Ist noch nichts aktiv, wird das erste beschreibbare Feld aktiv — so kann
    // man sofort lostippen, wie frueher mit autoFocus.
    if (f.id === lastActiveId || (!active && f.canFocus())) active = f;
    emit();
  },
  update(f: Field) {
    fields = fields.map(x => (x.id === f.id ? f : x));
    if (active?.id === f.id) active = f;
    emit();
  },
  unregister(id: number) {
    fields = fields.filter(f => f.id !== id);
    if (active?.id === id) { active = null; lastActiveId = id; }
    emit();
  },
  focus(id: number) {
    const f = fields.find(x => x.id === id);
    if (!f || !f.canFocus() || active?.id === id) return;
    active = f;
    emit();
  },
  // Zum naechsten beschreibbaren Feld (Reihenfolge wie auf dem Bildschirm) —
  // auf dem Probearbeits-Blatt bringt ✓ so von Aufgabe zu Aufgabe.
  focusNext() {
    const from = active ? fields.findIndex(f => f.id === active!.id) : -1;
    const next = fields.slice(from + 1).find(f => f.canFocus());
    if (next) { active = next; emit(); }
  },
  press(key: Key) {
    // Ist gerade nichts aktiv, nimmt das erste beschreibbare Feld die Taste.
    // ✓ braucht kein beschreibbares Feld: es landet notfalls beim ersten Feld.
    if (!active || !active.canFocus()) active = fields.find(f => f.canFocus()) ?? null;
    (active ?? (key === 'enter' ? fields[0] : null))?.press(key);
    emit();
  },
};

export const useKeypad = () => useSyncExternalStore(
  l => { listeners.add(l); return () => listeners.delete(l); },
  () => snapshot,
);
