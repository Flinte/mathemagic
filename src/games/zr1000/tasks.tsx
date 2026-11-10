/* eslint-disable react-refresh/only-export-components --
   Hier stehen keine Komponenten, nur Aufgaben-Generatoren, die ihr Bild als JSX
   mitliefern; die Fast-Refresh-Regel haelt die Datei deshalb faelschlich fuer
   ein Komponenten-Modul. */
import type { ReactNode } from 'react';
import { pick, randInt, shuffle } from '../shared';
import { numberWord } from './words';
import { Cross, MoneyPile, NumberLine, PlaceTable, Strip } from './visuals';

// Aufgaben fuer die Mathearbeit am 17.11.2026 (Zahlenraum bis 1000). Jede
// Aufgabe beschreibt sich selbst — Text, Bild, Eingabefelder, Loesung —, damit
// die Haeuser und die Probearbeit dieselben Aufgaben mischen koennen.

export type Topic =
  | 'stellenwert' | 'plaettchen' | 'streifen' | 'folgen' | 'zahlwort'
  | 'strahl' | 'nachfolger' | 'nachbarn' | 'runden' | 'ordnen' | 'geld';

// Reihenfolge und Wortlaut wie auf dem Lernzettel
export const TOPIC_LABEL: Record<Topic, string> = {
  stellenwert: 'Stellenwertschreibweise, Geheimschrift',
  plaettchen: 'Plättchen in der Stellenwerttafel',
  streifen: 'Ausschnitte aus dem Tausenderstreifen',
  folgen: 'Zahlenfolgen',
  zahlwort: 'Zahlwörter',
  strahl: 'Zahlenstrahl',
  nachfolger: 'Nachfolger, Vorgänger',
  nachbarn: 'Nachbarzehner, Nachbarhunderter',
  runden: 'Runden auf Zehner, auf Hunderter',
  ordnen: 'Zahlen ordnen',
  geld: 'Geld, Kommaschreibweise, Sachaufgaben',
};

export type Slot = (i: number) => ReactNode;

export interface Task {
  id: string;                 // fuer den Wiederholungs-Schutz
  topic: Topic;
  prompt: string;
  view?: (slot: Slot) => ReactNode;
  answers?: string[];         // je Eingabefeld die richtige Zahl
  comma?: boolean;            // Felder mit Komma (Euro), verglichen in Cent
  choice?: { options: string[]; correct: number };
  order?: number[];           // diese Zahlen von klein nach gross antippen
  build?: number;             // diese Zahl mit Plaettchen legen
  solution: string;           // wird nach einem Fehler gezeigt
  hint: string;               // Tipp: wie man auf die Loesung kommt, ohne sie zu verraten
}

const digits = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10] as [number, number, number];
const euro = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;

// Zahl mit einer Null an zufaelliger Stelle — die Null ist die haeufigste
// Fehlerquelle bei Geheimschrift und Stellenwerttafel (9E 7H = 709).
const withZero = () => {
  const [h, z, e] = [randInt(1, 9), randInt(1, 9), randInt(1, 9)];
  return pick([h * 100 + e, h * 100 + z * 10]);
};
const anyNumber = () => (Math.random() < 0.35 ? withZero() : randInt(101, 999));

// ── Stellenwert ──

const geheimschrift = (): Task => {
  const n = anyNumber();
  const [h, z, e] = digits(n);
  let parts = [[h, 'H'], [z, 'Z'], [e, 'E']].filter(([d]) => d !== 0) as [number, string][];
  if (Math.random() < 0.6) parts = shuffle(parts);
  const code = parts.map(([d, l]) => `${d}${l}`).join(' ');
  return {
    id: `gs${code}`, topic: 'stellenwert', prompt: 'Geheimschrift: Welche Zahl ist das?',
    view: slot => <div className="tk-line"><span className="tk-code">{code}</span> = {slot(0)}</div>,
    answers: [String(n)], hint: 'H heißt Hunderter, Z Zehner, E Einer. Schreibe erst die Hunderter, dann die Zehner, dann die Einer. Fehlt eine Stelle, schreibst du dort eine 0.',
    solution: `${code} = ${n}`,
  };
};

const zerlegen = (): Task => {
  const n = anyNumber();
  const [h, z, e] = digits(n);
  return {
    id: `zl${n}`, topic: 'stellenwert', prompt: 'Zerlege in Hunderter, Zehner und Einer.',
    view: slot => <div className="tk-line">{n} = {slot(0)} H {slot(1)} Z {slot(2)} E</div>,
    answers: [String(h), String(z), String(e)], hint: 'Die erste Ziffer sagt, wie viele Hunderter es sind, die zweite die Zehner, die letzte die Einer.',
    solution: `${n} = ${h} H ${z} Z ${e} E`,
  };
};

const plaettchenLesen = (): Task => {
  const n = anyNumber();
  return {
    id: `pl${n}`, topic: 'plaettchen', prompt: 'Welche Zahl liegt in der Stellenwerttafel?',
    view: slot => <><PlaceTable counts={digits(n)} /><div className="tk-line">Zahl: {slot(0)}</div></>,
    answers: [String(n)], hint: 'Zähle die Plättchen in jeder Spalte. Links die Hunderter, in der Mitte die Zehner, rechts die Einer.',
    solution: `Die Zahl ist ${n}.`,
  };
};

const plaettchenLegen = (): Task => {
  const n = anyNumber();
  const [h, z, e] = digits(n);
  return {
    id: `pb${n}`, topic: 'plaettchen', prompt: `Lege die Zahl ${n} mit Plättchen.`,
    build: n, hint: 'Lege in jede Spalte so viele Plättchen, wie die Ziffer sagt: links Hunderter, Mitte Zehner, rechts Einer. Mit + legst du eins dazu, mit − nimmst du eins weg.',
    solution: `${n}: ${h} Hunderter, ${z} Zehner, ${e} Einer`,
  };
};

const zahlwortLesen = (): Task => {
  const n = randInt(101, 999);
  return {
    id: `zw${n}`, topic: 'zahlwort', prompt: 'Schreibe das Zahlwort als Zahl.',
    view: slot => <div className="tk-line"><span className="tk-word">{numberWord(n)}</span> = {slot(0)}</div>,
    answers: [String(n)], hint: 'Zerlege das Wort: erst kommen die Hunderter, dann die Einer und zum Schluss die Zehner. Bei 324 sagt man drei-hundert-vier-und-zwanzig.',
    solution: `${numberWord(n)} = ${n}`,
  };
};

const zahlwortWaehlen = (): Task => {
  // Zehner und Einer verschieden und ungleich null — sonst gibt es keinen Zahlendreher.
  const h = randInt(1, 9), z = randInt(2, 9);
  let e = randInt(1, 9); if (e === z) e = z === 9 ? 1 : z + 1;
  const n = h * 100 + z * 10 + e;
  const dreher = h * 100 + e * 10 + z;
  // Dritte Antwort: Hunderter daneben oder Hunderter/Zehner vertauscht — nie doppelt.
  const others = shuffle([n + 100, n - 100, z * 100 + h * 10 + e, n + 10])
    .filter(v => v >= 100 && v <= 999 && v !== n && v !== dreher);
  const options = shuffle([n, dreher, others[0]]).map(numberWord);
  return {
    id: `zc${n}`, topic: 'zahlwort', prompt: `Wie heißt die Zahl ${n}?`,
    choice: { options, correct: options.indexOf(numberWord(n)) }, hint: 'Achte auf die Reihenfolge: Im Zahlwort kommen die Einer vor den Zehnern (vierundzwanzig = 24).',
    solution: `${n} = ${numberWord(n)}`,
  };
};

// ── Tausenderstreifen, Folgen, Nachbarn ──

const streifen = (): Task => {
  const step = pick([1, 1, 10]);
  const len = 6;
  const start = randInt(1, 1000 - (len - 1) * step);
  const nums = Array.from({ length: len }, (_, i) => start + i * step);
  const gaps = shuffle([1, 2, 3, 4, 5]).slice(0, 2).sort((a, b) => a - b);
  return {
    id: `st${start}-${step}`, topic: 'streifen', prompt: 'Ergänze den Ausschnitt aus dem Tausenderstreifen.',
    view: slot => <Strip cells={nums.map((v, i) => (gaps.includes(i) ? slot(gaps.indexOf(i)) : v))} />,
    answers: gaps.map(i => String(nums[i])), hint: step === 1 ? 'Im Tausenderstreifen kommt nach jeder Zahl die nächste: immer 1 mehr.' : 'Hier geht es in Zehnerschritten weiter: immer 10 mehr.',
    solution: nums.join(', '),
  };
};

const nachbarKreuz = (): Task => {
  const n = randInt(11, 989);
  return {
    id: `kr${n}`, topic: 'streifen', prompt: 'Ergänze die Nachbarzahlen: links und rechts 1 weniger und 1 mehr, oben und unten 10 weniger und 10 mehr.',
    view: slot => <Cross top={slot(0)} left={slot(1)} center={<b>{n}</b>} right={slot(2)} bottom={slot(3)} />,
    answers: [n - 10, n - 1, n + 1, n + 10].map(String),
    hint: 'Links steht 1 weniger, rechts 1 mehr. Oben steht 10 weniger, unten 10 mehr.',
    solution: `oben ${n - 10}, links ${n - 1}, rechts ${n + 1}, unten ${n + 10}`,
  };
};

const nachfolger = (): Task => {
  // Oft an Zehner- und Hunderter-Uebergaengen — dort passieren die Fehler.
  const n = Math.random() < 0.6 ? pick([randInt(1, 9) * 100, randInt(1, 9) * 100 - 1, randInt(10, 99) * 10, randInt(10, 99) * 10 - 1]) : randInt(2, 998);
  return {
    id: `nf${n}`, topic: 'nachfolger', prompt: 'Trage Vorgänger und Nachfolger ein.',
    view: slot => (
      <table className="tk-table"><thead><tr><th>Vorgänger</th><th>Zahl</th><th>Nachfolger</th></tr></thead>
        <tbody><tr><td>{slot(0)}</td><td><b>{n}</b></td><td>{slot(1)}</td></tr></tbody></table>
    ),
    answers: [String(n - 1), String(n + 1)], hint: 'Der Vorgänger ist 1 weniger, der Nachfolger ist 1 mehr. Pass auf, wenn ein neuer Zehner oder Hunderter beginnt.',
    solution: `${n - 1} – ${n} – ${n + 1}`,
  };
};

const folge = (): Task => {
  // Nur Schritte, die man im Kopf sicher gehen kann: 2 bis 9, ganze Zehner
  // oder ganze Hunderter — vorwaerts und rueckwaerts. (+15, +25 waren zu schwer.)
  const step = pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 20, 50, 100, 100, 200]);
  const d = Math.random() < 0.65 ? step : -step;
  const len = 6;
  const lo = d > 0 ? 0 : -d * (len - 1);
  const hi = d > 0 ? 1000 - d * (len - 1) : 1000;
  const start = randInt(lo, hi);   // bei +200 bleibt nur der Start bei 0
  const nums = Array.from({ length: len }, (_, i) => start + i * d);
  return {
    id: `fo${start}${d}`, topic: 'folgen', prompt: 'Setze die Zahlenfolge fort.',
    view: slot => <div className="tk-line tk-seq">{nums.slice(0, 4).join(', ')}, {slot(0)}, {slot(1)}</div>,
    answers: [String(nums[4]), String(nums[5])], hint: 'Rechne aus, wie viel von einer Zahl zur nächsten dazukommt oder weggeht. Dann geht es genauso weiter.',
    solution: `Immer ${d > 0 ? '+' : '−'}${Math.abs(d)}: ${nums.join(', ')}`,
  };
};

const nachbarzehner = (): Task => {
  const full = Math.random() < 0.25;
  const n = full ? randInt(2, 99) * 10 : randInt(11, 989);
  const lo = full ? n - 10 : Math.floor(n / 10) * 10;
  const hi = full ? n + 10 : lo + 10;
  if (!full && n % 10 === 0) return nachbarzehner();
  return {
    id: `nz${n}`, topic: 'nachbarn', prompt: 'Trage die Nachbarzehner ein.',
    view: slot => (
      <table className="tk-table"><thead><tr><th>Nachbarzehner</th><th>Zahl</th><th>Nachbarzehner</th></tr></thead>
        <tbody><tr><td>{slot(0)}</td><td><b>{n}</b></td><td>{slot(1)}</td></tr></tbody></table>
    ),
    answers: [String(lo), String(hi)], hint: 'Nachbarzehner sind die glatten Zehnerzahlen direkt davor und danach. Ist die Zahl selbst glatt, nimmst du 10 weniger und 10 mehr.',
    solution: `${lo} – ${n} – ${hi}`,
  };
};

const nachbarhunderter = (): Task => {
  const full = Math.random() < 0.2;
  const n = full ? randInt(1, 9) * 100 : randInt(101, 999);
  if (!full && n % 100 === 0) return nachbarhunderter();
  const lo = full ? n - 100 : Math.floor(n / 100) * 100;
  const hi = full ? n + 100 : lo + 100;
  return {
    id: `nh${n}`, topic: 'nachbarn', prompt: 'Trage die Nachbarhunderter ein.',
    view: slot => (
      <table className="tk-table"><thead><tr><th>Nachbarhunderter</th><th>Zahl</th><th>Nachbarhunderter</th></tr></thead>
        <tbody><tr><td>{slot(0)}</td><td><b>{n}</b></td><td>{slot(1)}</td></tr></tbody></table>
    ),
    answers: [String(lo), String(hi)], hint: 'Nachbarhunderter sind die glatten Hunderterzahlen direkt davor und danach. Ist die Zahl selbst glatt, nimmst du 100 weniger und 100 mehr.',
    solution: `${lo} – ${n} – ${hi}`,
  };
};

const runden = (to: 10 | 100) => (): Task => {
  // Die 5 bzw. 50 kommt bewusst oefter: "bei 5 wird aufgerundet".
  const n = to === 10
    ? (Math.random() < 0.25 ? randInt(1, 99) * 10 + 5 : randInt(11, 994))
    : (Math.random() < 0.25 ? randInt(1, 9) * 100 + 50 : randInt(101, 949));
  if (n % to === 0) return runden(to)();
  const r = Math.round(n / to) * to;   // .5 rundet in JS aufwaerts — wie in der Schule
  const lo = Math.floor(n / to) * to;
  return {
    id: `r${to}-${n}`, topic: 'runden', prompt: `Runde auf ${to === 10 ? 'Zehner' : 'Hunderter'}.`,
    view: slot => (
      <>
        <NumberLine from={lo} to={lo + to} step={to / 10} major={to / 2} labels={[lo, lo + to]}
          marks={[{ value: n, label: String(n), color: '#1e88e5' }]} />
        <div className="tk-line">{n} ≈ {slot(0)}</div>
      </>
    ),
    answers: [String(r)], hint: to === 10 ? 'Schau auf die Einer: Bei 0, 1, 2, 3, 4 rundest du ab, bei 5, 6, 7, 8, 9 rundest du auf.' : 'Schau auf die Zehner: Bei 0 bis 4 rundest du ab, bei 5 bis 9 rundest du auf.',
    solution: `${n} ≈ ${r}, weil ${n} näher an ${r} liegt${n % to === to / 2 ? ' (bei 5 wird aufgerundet)' : ''}.`,
  };
};

const ordnen = (): Task => {
  let nums: number[];
  if (Math.random() < 0.5) {
    // Dieselben Ziffern in anderer Reihenfolge — da muss man genau hinsehen.
    const ds = [randInt(1, 9), randInt(0, 9), randInt(1, 9)];
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
      .map(p => ds[p[0]] * 100 + ds[p[1]] * 10 + ds[p[2]]).filter(v => v >= 100);
    nums = [...new Set(perms)].slice(0, 4);
    while (nums.length < 4) { const v = randInt(100, 999); if (!nums.includes(v)) nums.push(v); }
  } else {
    const base = randInt(1, 8) * 100;
    nums = [];
    while (nums.length < 4) { const v = base + randInt(0, 150); if (!nums.includes(v)) nums.push(v); }
  }
  const sorted = [...nums].sort((a, b) => a - b);
  return {
    id: `or${sorted.join('-')}`, topic: 'ordnen', prompt: 'Tippe die Zahlen der Größe nach an. Beginne mit der kleinsten.',
    order: shuffle(nums), hint: 'Vergleiche zuerst die Hunderter. Sind sie gleich, vergleiche die Zehner, dann die Einer.',
    solution: sorted.join(' < '),
  };
};

// ── Zahlenstrahl ──

const strahlSetup = () => pick([
  // ganzer Tausender in Hunderterschritten
  () => ({ from: 0, to: 1000, step: 50, major: 100, labels: [0, 200, 400, 600, 800, 1000], pickFrom: 1, pickTo: 19, unit: 50 }),
  // ein Hunderter in Zehnerschritten
  () => { const a = randInt(1, 9) * 100; return { from: a, to: a + 100, step: 10, major: 50, labels: [a, a + 50, a + 100], pickFrom: 1, pickTo: 9, unit: 10 }; },
  // zwanzig Einer
  () => { const a = randInt(10, 97) * 10; return { from: a, to: a + 20, step: 1, major: 10, labels: [a, a + 10, a + 20], pickFrom: 1, pickTo: 19, unit: 1 }; },
])();

const strahlLesen = (): Task => {
  const s = strahlSetup();
  const ks = shuffle(Array.from({ length: s.pickTo - s.pickFrom + 1 }, (_, i) => s.pickFrom + i)).slice(0, 2).sort((a, b) => a - b);
  const vals = ks.map(k => s.from + k * s.unit).filter(v => !s.labels.includes(v));
  if (vals.length < 2) return strahlLesen();
  return {
    id: `sl${vals.join('-')}`, topic: 'strahl', prompt: 'Welche Zahlen zeigen die Pfeile?',
    view: slot => (
      <>
        <NumberLine from={s.from} to={s.to} step={s.step} major={s.major} labels={s.labels}
          marks={[{ value: vals[0], label: 'A' }, { value: vals[1], label: 'B', color: '#1e88e5' }]} />
        <div className="tk-line">A = {slot(0)} &nbsp; B = {slot(1)}</div>
      </>
    ),
    answers: vals.map(String), hint: 'Schau, welche Zahlen beschriftet sind, und zähle, wie viel ein kleiner Strich bedeutet.',
    solution: `A = ${vals[0]}, B = ${vals[1]}`,
  };
};

const strahlWaehlen = (): Task => {
  const s = strahlSetup();
  const ks = shuffle(Array.from({ length: s.pickTo - s.pickFrom + 1 }, (_, i) => s.pickFrom + i)
    .filter(k => !s.labels.includes(s.from + k * s.unit))).slice(0, 3).sort((a, b) => a - b);
  const vals = ks.map(k => s.from + k * s.unit);
  const target = randInt(0, 2);
  const names = ['A', 'B', 'C'];
  const colors = ['#e53935', '#1e88e5', '#43a047'];
  return {
    id: `sw${vals.join('-')}`, topic: 'strahl', prompt: `Welcher Pfeil zeigt auf ${vals[target]}?`,
    view: () => <NumberLine from={s.from} to={s.to} step={s.step} major={s.major} labels={s.labels}
      marks={vals.map((v, i) => ({ value: v, label: names[i], color: colors[i] }))} />,
    choice: { options: names, correct: target }, hint: 'Schau, welche Zahlen beschriftet sind, und zähle, wie viel ein kleiner Strich bedeutet.',
    solution: `${names[target]} zeigt auf ${vals[target]}.`,
  };
};

// ── Geld ──

const kommaSchreiben = (): Task => {
  const e = randInt(0, 20), c = Math.random() < 0.3 ? randInt(1, 9) : randInt(10, 99);
  return {
    id: `ks${e}-${c}`, topic: 'geld', prompt: 'Schreibe mit Komma.',
    view: slot => <div className="tk-line">{e > 0 && `${e} € `}{c} ct = {slot(0)} €</div>,
    answers: [euro(e * 100 + c)], comma: true, hint: '1 € sind 100 ct. Nach dem Komma stehen immer zwei Ziffern für die Cent: 5 ct schreibt man als 0,05 €.',
    solution: `${e > 0 ? `${e} € ` : ''}${c} ct = ${euro(e * 100 + c)} €`,
  };
};

const kommaLesen = (): Task => {
  const e = randInt(1, 20), c = Math.random() < 0.3 ? randInt(1, 9) : randInt(10, 99);
  return {
    id: `kl${e}-${c}`, topic: 'geld', prompt: 'Schreibe in Euro und Cent.',
    view: slot => <div className="tk-line">{euro(e * 100 + c)} € = {slot(0)} € {slot(1)} ct</div>,
    answers: [String(e), String(c)], hint: 'Vor dem Komma stehen die Euro, nach dem Komma die Cent. 0,05 € sind 5 ct.',
    solution: `${euro(e * 100 + c)} € = ${e} € ${c} ct`,
  };
};

const centInEuro = (): Task => {
  const cents = Math.random() < 0.3 ? randInt(1, 9) * 100 + randInt(1, 9) : randInt(105, 1999);
  return {
    id: `ce${cents}`, topic: 'geld', prompt: 'Wie viel Euro sind das?',
    view: slot => <div className="tk-line">{cents} ct = {slot(0)} €</div>,
    answers: [euro(cents)], comma: true, hint: '100 ct sind 1 €. Die letzten zwei Ziffern sind die Cent, sie stehen nach dem Komma.',
    solution: `${cents} ct = ${euro(cents)} €`,
  };
};

const muenzenZaehlen = (): Task => {
  const pool = [500, 1000, 2000, 200, 200, 100, 100, 50, 50, 20, 20, 10, 10, 5, 2, 1];
  const items = shuffle(pool).slice(0, randInt(4, 7)).sort((a, b) => b - a);
  const total = items.reduce((s, c) => s + c, 0);
  return {
    id: `mz${items.join('-')}`, topic: 'geld', prompt: 'Wie viel Geld ist das?',
    view: slot => <><MoneyPile items={items} /><div className="tk-line">{slot(0)} €</div></>,
    answers: [euro(total)], comma: true, hint: 'Zähle zuerst die Scheine und Euro-Münzen, dann die Cent. 100 ct sind 1 €.',
    solution: `Zusammen ${euro(total)} €`,
  };
};

const THINGS = ['ein Heft', 'einen Bleistift', 'ein Lineal', 'einen Radiergummi', 'eine Brezel', 'ein Eis', 'einen Apfel', 'einen Malkasten', 'ein Buch', 'eine Mappe'];
// Nur deutsche Vornamen.
const NAMES = ['Julia', 'Lena', 'Mia', 'Ben', 'Emma', 'Paul', 'Nele', 'Max', 'Anna', 'Lukas'];
// Preise in ganzen und halben Euro (0,50 € bis 9,50 €): Gerechnet wird ohne
// krumme Cent-Betraege, geschrieben wird trotzdem mit Komma (z. B. 5,50 €).
const price = () => randInt(1, 19) * 50;

const einkauf = (): Task => {
  const name = pick(NAMES);
  const [a, b] = shuffle(THINGS).slice(0, 2);
  const pa = price(), pb = price();
  if (Math.random() < 0.5) {
    return {
      id: `ek${pa}-${pb}`, topic: 'geld', prompt: 'Sachaufgabe',
      view: slot => (
        <div className="tk-story">
          <p>{name} kauft {a} für {euro(pa)} € und {b} für {euro(pb)} €.</p>
          <p>Wie viel muss {name} bezahlen?</p>
          <div className="tk-line">{slot(0)} €</div>
        </div>
      ),
      answers: [euro(pa + pb)], comma: true, hint: 'Rechne beide Preise zusammen: erst die Euro, dann die Cent. 100 ct sind 1 €.',
    solution: `${euro(pa)} € + ${euro(pb)} € = ${euro(pa + pb)} €`,
    };
  }
  const paid = [500, 1000, 2000].find(p => p > pa) ?? 2000;   // mit dem naechstgroesseren Schein
  return {
    id: `rg${pa}-${paid}`, topic: 'geld', prompt: 'Sachaufgabe',
    view: slot => (
      <div className="tk-story">
        <p>{name} kauft {a} für {euro(pa)} €.</p>
        <p>{name} bezahlt mit {paid / 100} €. Wie viel Rückgeld bekommt {name}?</p>
        <div className="tk-line">{slot(0)} €</div>
      </div>
    ),
    answers: [euro(paid - pa)], comma: true, hint: 'Rückgeld: Rechne vom Preis aus bis zu dem Geld, mit dem bezahlt wird.',
    solution: `${paid / 100},00 € − ${euro(pa)} € = ${euro(paid - pa)} €`,
  };
};

// ── Welche Aufgaben in welchem Haus ──
// Mehrfach genannte Generatoren kommen entsprechend oefter dran.
export const GAME_TASKS = {
  stellenwert: [geheimschrift, geheimschrift, zerlegen, plaettchenLesen, plaettchenLegen, zahlwortLesen, zahlwortWaehlen],
  'tausender-streifen': [streifen, nachbarKreuz, nachbarKreuz, nachfolger, folge, folge, ordnen],
  zahlenstrahl: [strahlLesen, strahlLesen, strahlWaehlen],
  runden: [nachbarzehner, nachbarhunderter, runden(10), runden(10), runden(100), runden(100)],
  geld: [kommaSchreiben, kommaLesen, centInEuro, muenzenZaehlen, muenzenZaehlen, einkauf, einkauf],
} as const;

export type TaskGameId = keyof typeof GAME_TASKS;

// Die Probearbeit: zu jedem Thema des Lernzettels eine Aufgabe, in der
// Reihenfolge des Zettels — wie es in der echten Arbeit wohl auch sein wird.
export const EXAM_PLAN: (() => Task)[][] = [
  [geheimschrift, zerlegen],
  [plaettchenLesen, plaettchenLegen],
  [streifen, nachbarKreuz],
  [folge],
  [zahlwortLesen, zahlwortWaehlen],
  [strahlLesen, strahlWaehlen],
  [nachfolger],
  [nachbarzehner, nachbarhunderter],
  [runden(10), runden(100)],
  [ordnen],
  [kommaSchreiben, kommaLesen, centInEuro, muenzenZaehlen],
  [einkauf],
];

// ── Vergleich ──
const toCents = (s: string) => {
  const [e, c = ''] = s.split(',');
  return Number(e || 0) * 100 + Number((c + '00').slice(0, 2));
};
export const isRight = (input: string, answer: string, comma = false) =>
  input !== '' && (comma ? toCents(input) === toCents(answer) : Number(input) === Number(answer));
