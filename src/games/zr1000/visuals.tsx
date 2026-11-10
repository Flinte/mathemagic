import type { ReactNode } from 'react';

// Bilder fuer die Aufgaben im Zahlenraum bis 1000 — nachgebaut nach den
// Darstellungen aus Julias Mathebuch.

// ── Stellenwerttafel mit Plaettchen ──
// Bis zu 9 Plaettchen je Spalte, in Fuenfer-Reihen gelegt wie im Heft — so
// kann man sie schnell zaehlen, ohne jedes einzeln anzutippen.
const PLACES = [
  { key: 'H', label: 'H', title: 'Hunderter' },
  { key: 'Z', label: 'Z', title: 'Zehner' },
  { key: 'E', label: 'E', title: 'Einer' },
] as const;

export const PlaceTable = ({ counts, onChange }: {
  counts: [number, number, number];
  // Ohne onChange nur zum Ablesen; mit onChange kann man Plaettchen legen.
  onChange?: (counts: [number, number, number]) => void;
}) => (
  <div className={`place-table ${onChange ? 'editable' : ''}`}>
    {PLACES.map((p, i) => (
      <div key={p.key} className="place-col">
        <div className="place-head" title={p.title}>{p.label}</div>
        <div className="place-dots">
          {Array.from({ length: counts[i] }, (_, k) => <span key={k} className="place-dot" />)}
        </div>
        {onChange && (
          <div className="place-buttons">
            <button aria-label={`${p.title} wegnehmen`} disabled={counts[i] === 0}
              onClick={() => onChange(counts.map((c, j) => (j === i ? c - 1 : c)) as [number, number, number])}>−</button>
            <button aria-label={`${p.title} dazulegen`} disabled={counts[i] === 9}
              onClick={() => onChange(counts.map((c, j) => (j === i ? c + 1 : c)) as [number, number, number])}>+</button>
          </div>
        )}
      </div>
    ))}
  </div>
);

// ── Zahlenstrahl ──
// Ein Ausschnitt von `from` bis `to` mit Strichen alle `step`; jeder `major`-te
// Strich ist lang und beschriftet. Pfeile zeigen auf die gefragten Stellen.
export const NumberLine = ({ from, to, step, major, labels, marks }: {
  from: number; to: number; step: number; major: number;
  labels?: number[];                       // ohne Angabe: jeder lange Strich
  marks: { value: number; label: string; color?: string }[];
}) => {
  // Schmale Zeichenflaeche: auf dem Handy wird sie kaum verkleinert, Zahlen bleiben lesbar.
  const W = 480, PAD = 28, Y = 70;
  const x = (v: number) => PAD + ((v - from) / (to - from)) * (W - 2 * PAD);
  const ticks: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) ticks.push(Math.round(v));
  const shown = new Set(labels ?? ticks.filter(v => (v - from) % major === 0));
  return (
    <svg className="number-line" viewBox={`0 0 ${W} 120`} role="img" aria-label={`Zahlenstrahl von ${from} bis ${to}`}>
      {/* Eigene weisse Flaeche: die Karos des Heftes passten nicht zu den Strichen und verwirrten. */}
      <rect x="1" y="1" width={W - 2} height="118" rx="12" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
      <line x1={PAD - 12} y1={Y} x2={W - PAD + 18} y2={Y} stroke="#334155" strokeWidth="3" />
      <path d={`M ${W - PAD + 18} ${Y} l -10 -6 v 12 z`} fill="#334155" />
      {ticks.map(v => {
        const big = (v - from) % major === 0;
        return (
          <g key={v}>
            <line x1={x(v)} y1={Y - (big ? 14 : 7)} x2={x(v)} y2={Y + (big ? 14 : 7)} stroke="#334155" strokeWidth={big ? 2.5 : 1.5} />
            {shown.has(v) && <text x={x(v)} y={Y + 36} textAnchor="middle" fontSize={shown.size > 4 ? 16 : 19} fontWeight="700" fill="#1f2937">{v}</text>}
          </g>
        );
      })}
      {marks.map(m => (
        <g key={m.label}>
          <path d={`M ${x(m.value)} ${Y - 18} l -8 -14 h 16 z`} fill={m.color ?? '#e53935'} />
          <text x={x(m.value)} y={Y - 38} textAnchor="middle" fontSize="18" fontWeight="800" fill={m.color ?? '#e53935'}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
};

// ── Geld ──
// Muenzen als Kreise, Scheine als Rechtecke, in etwa in den echten Farben.
const COIN_STYLE: Record<number, { fill: string; ring?: string; r: number }> = {
  1: { fill: '#c77b4a', r: 16 }, 2: { fill: '#c77b4a', r: 18 }, 5: { fill: '#c77b4a', r: 20 },
  10: { fill: '#e2b84a', r: 19 }, 20: { fill: '#e2b84a', r: 21 }, 50: { fill: '#e2b84a', r: 23 },
  100: { fill: '#d4d4d8', ring: '#e2b84a', r: 22 }, 200: { fill: '#e2b84a', ring: '#d4d4d8', r: 24 },
};
const NOTE_COLOR: Record<number, string> = { 500: '#9ca3af', 1000: '#ef8a8a', 2000: '#7aa7e0', 5000: '#f3a95b' };

const money = (cents: number) => (cents >= 100 ? `${cents / 100} €` : `${cents} ct`);

export const MoneyPile = ({ items }: { items: number[] }) => (
  <div className="money-pile">
    {items.map((c, i) => {
      if (NOTE_COLOR[c]) {
        return (
          <svg key={i} className="money-note" viewBox="0 0 96 52" aria-label={money(c)}>
            <rect x="2" y="2" width="92" height="48" rx="6" fill={NOTE_COLOR[c]} stroke="#475569" strokeWidth="2" />
            <text x="48" y="34" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1f2937">{c / 100} €</text>
          </svg>
        );
      }
      const s = COIN_STYLE[c];
      return (
        <svg key={i} className="money-coin" viewBox="0 0 52 52" style={{ width: s.r * 2.2 }} aria-label={money(c)}>
          {s.ring && <circle cx="26" cy="26" r="24" fill={s.ring} stroke="#475569" strokeWidth="1.5" />}
          <circle cx="26" cy="26" r={s.ring ? 17 : 24} fill={s.fill} stroke="#475569" strokeWidth="1.5" />
          <text x="26" y="31" textAnchor="middle" fontSize={c >= 100 ? 13 : 14} fontWeight="800" fill="#1f2937">
            {c >= 100 ? `${c / 100}€` : c}
          </text>
        </svg>
      );
    })}
  </div>
);

// ── Nachbar-Kreuz wie im Heft: oben −10, links −1, rechts +1, unten +10 ──
export const Cross = ({ top, left, center, right, bottom }: Record<'top' | 'left' | 'center' | 'right' | 'bottom', ReactNode>) => (
  <div className="cross">
    {/* Kleine Rechenzeichen an den Armen: ohne sie war nicht klar, dass oben
        10 weniger und unten 10 mehr gehoert. */}
    <div className="cross-cell" style={{ gridArea: 'top' }}><span className="cross-op">−10</span>{top}</div>
    <div className="cross-cell" style={{ gridArea: 'left' }}><span className="cross-op">−1</span>{left}</div>
    <div className="cross-cell center" style={{ gridArea: 'center' }}>{center}</div>
    <div className="cross-cell" style={{ gridArea: 'right' }}><span className="cross-op">+1</span>{right}</div>
    <div className="cross-cell" style={{ gridArea: 'bottom' }}><span className="cross-op">+10</span>{bottom}</div>
  </div>
);

// ── Ausschnitt aus dem Tausenderstreifen: eine Reihe Kaestchen ──
export const Strip = ({ cells }: { cells: ReactNode[] }) => (
  <div className="strip">{cells.map((c, i) => <div key={i} className="strip-cell">{c}</div>)}</div>
);
