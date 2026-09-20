import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Star } from 'lucide-react';

// --- Zufall ---
// Alle Generatoren ziehen ueber diese Helfer, damit Verteilung und
// Wiederholungs-Schutz an genau einer Stelle liegen.

// Ganzzahl in [min, max] — beide Grenzen eingeschlossen.
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

// Fisher-Yates. Das naheliegende `sort(() => Math.random() - 0.5)` ist KEIN
// gueltiger Shuffle: Vergleichsfunktionen muessen konsistent sein, sonst haengt
// das Ergebnis am Sortier-Algorithmus. Gemessen an der Zahlen-Mauer wurde damit
// Stein 1 in 57 % der Runden versteckt, Stein 4 nur in 39 % — die Mauer fragte
// also immer wieder dieselben Positionen ab.
const shuffle = <T,>(list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Zieht eine Aufgabe, die nicht unter den letzten `memory` Aufgaben desselben
// Fachs war. Ohne das kann bei freiem Wuerfeln dieselbe Aufgabe sofort wieder
// kommen — im Spiegel-Haus (20 moegliche Aufgaben) enthielt so jede siebte
// 3er-Runde eine Dopplung.
//
// `memory` muss klar unter dem Vorrat bleiben, sonst laeuft die Suche leer und
// wir setzen doch eine Wiederholung vor — deshalb steht der Wert je Fach unten
// neben dem Generator und nicht als globale Konstante.
const recent: Record<string, string[]> = {};
const drawFresh = <T,>(bucket: string, memory: number, roll: () => T, idOf: (t: T) => string): T => {
  const seen = recent[bucket] ?? (recent[bucket] = []);
  let out = roll();
  for (let tries = 0; tries < 60 && seen.includes(idOf(out)); tries++) out = roll();
  seen.push(idOf(out));
  while (seen.length > memory) seen.shift();
  return out;
};

// --- Fokus ---
// Jedes Eingabefeld ist aktiv, sobald es erscheint — ohne Klick lostippen.
// `autoFocus` allein reicht dafuer nicht: es greift nur beim Einhaengen ins DOM,
// und die meisten Haeuser tauschen zwischen zwei Aufgaben nur den Inhalt
// desselben Feldes aus. `setTimeout(..., 0)` ist ebenfalls unzuverlaessig — zu
// dem Zeitpunkt kann das Feld noch gar nicht im DOM stehen.
//
// `ref` darf je nach Zustand ein anderes Feld sein; deps steuern, wann neu
// fokussiert wird. focus() auf ein bereits aktives Feld ist folgenlos.
const useAutoFocus = (
  ref: { current: HTMLInputElement | null },
  deps: React.DependencyList,
) => useEffect(() => { ref.current?.focus(); }, deps);

// --- Sound Engine ---
// Ein einziger AudioContext für die ganze App — Browser erlauben nur eine Handvoll
// gleichzeitig, und jeder neue kostet spürbar Zeit beim Anlegen.
let audioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
};

const playSound = (type: 'correct' | 'wrong') => {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) { console.error('Audio error', e); }
};

// --- Types & Constants ---
type Category =
  | 'plus' | 'minus' | 'verdoppeln-halbieren'
  | 'einmaleins-klein' | 'einmaleins-gross' | 'einmaleins-tafel'
  | 'division' | 'division-zerlegen' | 'division-rest' | 'tausch-arena' | 'kernaufgaben'
  | 'sachaufgaben' | 'platzhalter' | 'punkt-vor-strich' | 'uhrzeit'
  | 'zahlen-fabrik' | 'meister-zelt' | 'differenz-jagd' | 'zahlen-mauer';

const STICKERS = ['⭐', '🌟', '🦄', '🚀', '🎨', '🍕', '🐱', '🐶', '🌈', '🍦', '🍩', '🦁', '🦉', '💎', '🍭', '⚙️', '🏆', '🎈', '🏰'];
// Der Panda ist das Maskottchen der Klasse 3b und wohnt von Anfang an im Dorf —
// Schwelle 0. Alle anderen Tiere ziehen nach und nach zu.
const ANIMAL_TIERS = [
  { threshold: 0,  emoji: '🐼' },
  { threshold: 5,  emoji: '🐰' },
  { threshold: 10, emoji: '🦌' },
  { threshold: 15, emoji: '🦊' },
  { threshold: 20, emoji: '🐿️' },
  { threshold: 25, emoji: '🦔' },
  { threshold: 30, emoji: '🦄' },
];

// Fixed spots on the map where each tier animal lives
const ANIMAL_SPOTS: { threshold: number; emoji: string; left: string; top: string }[] = [
  { threshold: 0,  emoji: '🐼', left: '30%', top: '71%' },   // im Bambushain
  { threshold: 5,  emoji: '🐰', left: '17%', top: '90%' },
  { threshold: 10, emoji: '🦌', left: '5%',  top: '57%' },
  { threshold: 15, emoji: '🦊', left: '27%', top: '85%' },
  { threshold: 20, emoji: '🐿️', left: '62%', top: '67%' },
  { threshold: 25, emoji: '🦔', left: '77%', top: '92%' },
  { threshold: 30, emoji: '🦄', left: '50%', top: '88%' },
];

interface PerformanceData { [key: string]: number; }

const DEFAULT_STICKERS: Record<Category, string[]> = {
  plus: [], minus: [], 'verdoppeln-halbieren': [],
  'einmaleins-klein': [], 'einmaleins-gross': [], 'einmaleins-tafel': [],
  division: [], 'division-zerlegen': [], 'division-rest': [], 'tausch-arena': [], kernaufgaben: [],
  sachaufgaben: [], platzhalter: [], 'punkt-vor-strich': [], uhrzeit: [],
  'zahlen-fabrik': [], 'meister-zelt': [], 'differenz-jagd': [], 'zahlen-mauer': [],
};

// Namen wechseln die Aufgabentexte durch, ohne die Rechnung zu aendern — das
// hebt die gefuehlte Vielfalt der Rechen-Post deutlich, weil zwei Aufgaben mit
// derselben Rechnung trotzdem verschieden aussehen.
const NAMES = ['Lilly', 'Klaus', 'Mia', 'Jonas', 'Emma', 'Ben', 'Frieda', 'Paul', 'Nele', 'Ali', 'Sofia', 'Levi'];

// Aufgaben-Vorlagen der Rechen-Post. Vorher waren es zwei — damit bestand jede
// 3er-Runde zwangslaeufig aus zwei gleichen Aufgaben. Mal und Geteilt sind
// bewusst dabei, das sind Themen der naechsten Klassenarbeit.
const STORY_TEMPLATES: (() => { question: string[]; answer: number; key: string })[] = [
  () => { const n = pick(NAMES), x = randInt(2, 5), y = randInt(2, 4), z = randInt(3, 7); return {
    question: [`${n} kauft ${x} Kaugummis für je ${y} €.`, `Dazu eine Schokolade für ${z} €.`, `Reichen ${n}s 20 €? (1 = Ja, 0 = Nein)`],
    answer: 20 >= x * y + z ? 1 : 0, key: 'story_budget' }; },
  () => { const n = pick(NAMES), x = randInt(12, 30), y = randInt(2, 9); return {
    question: [`${n} hat ${x} €.`, `Für ein Eis gehen ${y} € weg.`, `Wie viele Euro bleiben übrig?`],
    answer: x - y, key: 'story_rest' }; },
  () => { const n = pick(NAMES), k = randInt(2, 6), q = randInt(2, 9); return {
    question: [`${n} teilt ${k * q} Gummibärchen`, `gerecht an ${k} Kinder aus.`, `Wie viele bekommt jedes Kind?`],
    answer: q, key: 'story_teilen' }; },
  () => { const n = pick(NAMES), p = randInt(3, 8), q = randInt(3, 9); return {
    question: [`${n} packt ${p} Schachteln ein.`, `In jede kommen ${q} Stifte.`, `Wie viele Stifte sind das zusammen?`],
    answer: p * q, key: 'story_mal' }; },
  () => { const r = randInt(4, 9); return {
    question: [`Im Bus stehen ${r} Sitzreihen.`, `In jeder Reihe sind 4 Plätze.`, `Wie viele Kinder passen hinein?`],
    answer: r * 4, key: 'story_bus' }; },
  () => { const n = pick(NAMES), hat = randInt(8, 25), braucht = randInt(30, 50); return {
    question: [`${n} sammelt Sticker.`, `${n} hat schon ${hat} Stück, das Album braucht ${braucht}.`, `Wie viele fehlen noch?`],
    answer: braucht - hat, key: 'story_fehlt' }; },
  () => { const n = pick(NAMES), k = randInt(2, 8), preis = randInt(2, 9); return {
    question: [`${n} kauft ${k} gleiche Hefte.`, `Zusammen kosten sie ${k * preis} €.`, `Was kostet ein Heft?`],
    answer: preis, key: 'story_stueckpreis' }; },
  () => { const b = randInt(3, 7), s = randInt(3, 8); return {
    question: [`Ein Strauß besteht aus ${b} Blumen.`, `Die Gärtnerin bindet ${s} Sträuße.`, `Wie viele Blumen braucht sie?`],
    answer: b * s, key: 'story_blumen' }; },
  () => { const n = pick(NAMES), tage = randInt(3, 7), pro = randInt(4, 9); return {
    question: [`${n} liest jeden Tag ${pro} Seiten.`, `Das macht ${n} ${tage} Tage lang.`, `Wie viele Seiten sind das?`],
    answer: tage * pro, key: 'story_lesen' }; },
];

const rollProblem = (category: Category): any => {
  let a, b;

  if (category === 'platzhalter') {
    // Mal und Geteilt gehoeren mit dazu — Zahlenraetsel der Klassenarbeit
    // fragen nicht nur nach Plus und Minus.
    const type = randInt(0, 5);
    if (type <= 2) {
      a = randInt(2, 11);
      const ans = randInt(2, 11);
      if (type === 0) return { question: `? + ${a} = ${ans + a}`, answer: ans, key: 'ph_plus', type: 'placeholder' };
      if (type === 1) return { question: `${a} + ? = ${ans + a}`, answer: ans, key: 'ph_plus', type: 'placeholder' };
      return { question: `? − ${a} = ${ans}`, answer: ans + a, key: 'ph_minus', type: 'placeholder' };
    }
    a = randInt(2, 10);
    b = randInt(2, 10);
    if (type === 3) return { question: `? × ${a} = ${a * b}`, answer: b, key: 'ph_mal', type: 'placeholder' };
    if (type === 4) return { question: `${a} × ? = ${a * b}`, answer: b, key: 'ph_mal', type: 'placeholder' };
    return { question: `${a * b} : ? = ${b}`, answer: a, key: 'ph_geteilt', type: 'placeholder' };
  }

  if (category === 'sachaufgaben') return { ...pick(STORY_TEMPLATES)(), type: 'story' };

  if (category === 'einmaleins-klein' || category === 'einmaleins-gross') {
    a = category === 'einmaleins-klein' ? randInt(2, 5) : randInt(2, 10);
    b = randInt(1, 10);
    return { question: `${a} × ${b}`, answer: a * b, key: `${a}x${b}` };
  }

  if (category === 'division') {
    // Wird nur noch als Fallback genutzt — routing geht zu DivisionGame
    a = randInt(2, 10);
    b = randInt(1, 10);
    return { question: `${a * b} : ${a}`, answer: b, key: 'div_result' };
  }

  if (category === 'kernaufgaben') {
    a = pick([2, 5, 10]);
    b = randInt(1, 10);
    if (Math.random() < 0.5) return { question: `${a} × ${b}`, answer: a * b, key: 'kern_mult' };
    return { question: `${a * b} : ${a}`, answer: b, key: 'kern_div' };
  }

  if (category === 'verdoppeln-halbieren') {
    // Bis 20 statt bis 10: verdoppelt das reicht bis 40 und damit ueber den
    // Zahlenraum, in dem die Kernaufgaben-Strategie geuebt wird.
    if (Math.random() < 0.5) { a = randInt(1, 20); return { question: `Doppelt von ${a}`, answer: a * 2, key: 'double' }; }
    a = randInt(1, 20) * 2;
    return { question: `Hälfte von ${a}`, answer: a / 2, key: 'half' };
  }

  if (category === 'plus') { a = randInt(5, 14); b = randInt(5, 14); return { question: `${a} + ${b}`, answer: a + b, key: 'plus' }; }
  if (category === 'minus') { a = randInt(6, 20); b = randInt(1, a - 1); return { question: `${a} − ${b}`, answer: a - b, key: 'minus' }; }
  return { question: '?', answer: 0, key: 'unknown' };
};

// Wie viele der zuletzt gestellten Aufgaben je Haus gesperrt bleiben. Der Wert
// muss deutlich unter dem Vorrat des Hauses liegen: `einmaleins-klein` kennt nur
// 40 Aufgaben, eine Sperre von 20 wuerde die Auswahl spuerbar verarmen lassen.
const VARIETY: Record<string, number> = {
  'verdoppeln-halbieren': 8,
  'einmaleins-klein': 8,
  'kernaufgaben': 10,
  'sachaufgaben': 4,
  'einmaleins-gross': 15,
  'platzhalter': 15,
  'plus': 15,
  'minus': 15,
};

const generateProblem = (category: Category, _performance: PerformanceData = {}): any =>
  drawFresh(
    category,
    VARIETY[category] ?? 10,
    () => rollProblem(category),
    // Sachaufgaben ueber den Text vergleichen, sonst gaelten zwei Aufgaben
    // derselben Vorlage mit verschiedenen Zahlen faelschlich als Wiederholung.
    p => (Array.isArray(p.question) ? p.question.join('|') : String(p.question)),
  );

// ============================================================
// MAP COMPONENTS
// ============================================================

// Bäume: Positionen in Karten-Koordinaten (viewBox 1300×700)
const TREE_SPOTS: { x: number; y: number; s?: number }[] = [
  { x: 39, y: 56 }, { x: 91, y: 35, s: 0.72 }, { x: 52, y: 126, s: 0.72 },
  { x: 143, y: 77 }, { x: 195, y: 49, s: 0.72 }, { x: 104, y: 175 },
  { x: 1157, y: 42 }, { x: 1222, y: 63, s: 0.72 }, { x: 1183, y: 126, s: 0.72 },
  { x: 1261, y: 98 }, { x: 1118, y: 91, s: 0.72 },
  { x: 325, y: 42, s: 0.72 }, { x: 377, y: 63 }, { x: 351, y: 98, s: 0.72 },
  { x: 819, y: 476 }, { x: 858, y: 448, s: 0.72 },
  { x: 650, y: 546, s: 0.72 }, { x: 728, y: 518 },
  { x: 416, y: 602, s: 0.72 }, { x: 468, y: 630, s: 0.72 },
  { x: 26, y: 350, s: 0.72 }, { x: 1274, y: 336, s: 0.72 },
];

// Grasbüschel an den Wegrändern — brechen die Silhouette auf, damit der Weg
// nicht wie aufgeklebt wirkt. Das ist der eigentliche Trick.
const PATH_TUFTS: [number, number][] = [
  [60, 393], [150, 384], [250, 382], [360, 435], [470, 443], [560, 397],
  [640, 441], [740, 388], [830, 431], [930, 383], [1030, 430], [1120, 385],
  [1210, 427], [1270, 378], [78, 470], [146, 502], [96, 538], [166, 568],
  [458, 360], [500, 300], [452, 240], [600, 158], [700, 192], [750, 152],
  [952, 300], [1010, 380], [958, 460], [300, 450], [280, 520], [310, 570],
];

// Erdflecken im Weginneren. Bewusst ungleichmäßig gestreut und unterschiedlich
// gedreht: jede durchgehende Längsstruktur liest sich sofort wieder als Straße.
const PATH_SPECKS: [number, number, number, number, number, string][] = [
  [40, 428, 7, 4, -12, '#cfb185'], [88, 410, 5, 3, 8, '#f3e7c6'], [130, 421, 9, 4, -6, '#c7a878'],
  [176, 402, 4, 2.5, 14, '#bda06f'], [220, 412, 7, 3.5, -9, '#f3e7c6'], [268, 398, 5, 3, 6, '#cfb185'],
  [312, 418, 8, 4, -14, '#c7a878'], [356, 400, 4, 2.5, 10, '#bda06f'], [400, 424, 6, 3, -5, '#f3e7c6'],
  [446, 406, 7, 3.5, 12, '#cfb185'], [490, 428, 5, 3, -8, '#f3e7c6'], [534, 410, 9, 4, 4, '#c7a878'],
  [578, 430, 4, 2.5, -11, '#bda06f'], [622, 408, 6, 3.5, 9, '#f3e7c6'], [666, 426, 8, 4, -6, '#cfb185'],
  [710, 404, 5, 3, 13, '#f3e7c6'], [754, 422, 7, 3.5, -9, '#c7a878'], [798, 400, 4, 2.5, 5, '#bda06f'],
  [842, 416, 9, 4, -13, '#cfb185'], [886, 396, 6, 3, 8, '#f3e7c6'], [930, 418, 5, 3, -7, '#c7a878'],
  [974, 398, 7, 3.5, 11, '#f3e7c6'], [1018, 420, 4, 2.5, -5, '#bda06f'], [1062, 400, 8, 4, 9, '#cfb185'],
  [1106, 418, 6, 3, -12, '#f3e7c6'], [1150, 396, 5, 3, 6, '#c7a878'], [1194, 414, 7, 3.5, -8, '#f3e7c6'],
  [1238, 394, 4, 2.5, 12, '#bda06f'], [1278, 408, 6, 3, -6, '#cfb185'],
  [104, 442, 5, 3, -10, '#cfb185'], [116, 476, 4, 2.5, 8, '#f3e7c6'], [126, 512, 6, 3, -6, '#c7a878'],
  [134, 548, 4, 2.5, 12, '#bda06f'], [142, 582, 5, 3, -9, '#f3e7c6'],
  [478, 386, 5, 3, 7, '#cfb185'], [474, 330, 4, 2.5, -11, '#f3e7c6'], [472, 268, 6, 3, 6, '#c7a878'],
  [476, 214, 4, 2.5, -8, '#bda06f'],
  [590, 184, 5, 3, 9, '#f3e7c6'], [660, 174, 4, 2.5, -7, '#cfb185'], [736, 174, 5, 3, 11, '#c7a878'],
  [826, 178, 4, 2.5, -6, '#f3e7c6'], [922, 202, 5, 3, 8, '#bda06f'],
  [976, 300, 5, 3, -9, '#cfb185'], [988, 366, 4, 2.5, 7, '#f3e7c6'], [990, 434, 5, 3, -12, '#c7a878'],
  [312, 452, 4, 2.5, -8, '#f3e7c6'], [302, 516, 5, 3, 10, '#cfb185'], [294, 578, 4, 2.5, -6, '#c7a878'],
];

const MAIN_ROAD = 'M 0 422 C 88 412, 208 404, 318 408 S 516 422, 676 416 S 896 406, 1072 410 S 1222 404, 1300 400';
const PATH_PLAZA = 'M 96 416 C 110 474, 124 538, 146 604';
const PATH_SCHOOL = 'M 482 414 C 478 340, 470 264, 476 184';
const PATH_EAST = 'M 542 192 C 624 180, 712 170, 778 176';
const PATH_ADVENTURE = 'M 778 176 C 858 172, 928 196, 966 254';
const PATH_RIGHT = 'M 966 254 C 984 344, 992 420, 982 466';
const PATH_SOUTH = 'M 318 408 C 310 480, 298 548, 292 618';

// Alle Wege in einem Durchgang: erst die weiche Erdaura, dann die Wegfläche,
// dann die unscharfe Aufhellung. Kein Mittelstreifen, keine Zebrastreifen.
const PATHS: { d: string; w: number }[] = [
  { d: MAIN_ROAD, w: 42 }, { d: PATH_PLAZA, w: 28 }, { d: PATH_SCHOOL, w: 30 },
  { d: PATH_EAST, w: 26 }, { d: PATH_ADVENTURE, w: 24 }, { d: PATH_RIGHT, w: 24 },
  { d: PATH_SOUTH, w: 18 },
];

// Bambushain — das Zuhause des Pandas. Halme werden leicht unterschiedlich
// hoch und geneigt gezeichnet; ein Hain aus identischen Halmen liest sich sofort
// als Zaun statt als Pflanze.
// Zwei Gruppen mit einer Luecke in der Mitte — dort steht der Panda, sonst
// verschwindet er hinter den Halmen.
const BAMBOO_SPOTS: { x: number; y: number; h: number; lean: number }[] = [
  { x: 352, y: 524, h: 62, lean: -5 }, { x: 366, y: 530, h: 82, lean: 2 },
  { x: 379, y: 522, h: 54, lean: 4 },
  { x: 424, y: 528, h: 76, lean: -3 }, { x: 437, y: 521, h: 58, lean: 4 },
  { x: 449, y: 530, h: 88, lean: -2 },
];

const MapBamboo = ({ x, y, h, lean }: { x: number; y: number; h: number; lean: number }) => (
  <g transform={`translate(${x},${y}) rotate(${lean})`}>
    <ellipse cx="0" cy="2" rx="11" ry="4" fill="#4a7f38" opacity="0.3" filter="url(#fSoft)" />
    <rect x="-3" y={-h} width="6" height={h} rx="3" fill="#7cb342" />
    {/* Knoten: die Segmentierung ist das, was einen Halm als Bambus lesbar macht */}
    {Array.from({ length: Math.floor(h / 18) }, (_, i) => (
      <rect key={i} x="-4" y={-h + 14 + i * 18} width="8" height="2.5" rx="1.2" fill="#558b2f" />
    ))}
    <path d={`M 2 ${-h + 8} q 16 -8 24 2 q -16 4 -24 -2 Z`} fill="#8bc34a" />
    <path d={`M -2 ${-h + 26} q -18 -7 -26 3 q 17 4 26 -3 Z`} fill="#689f38" />
    <path d={`M 2 ${-h + 44} q 15 -6 22 3 q -15 3 -22 -3 Z`} fill="#8bc34a" opacity="0.9" />
  </g>
);

const MapTree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <ellipse cx="6" cy="24" rx="26" ry="8" fill="#4a7f38" opacity="0.35" filter="url(#fSoft)" />
    <path d="M -4 24 L -4 4 q 4 -6 8 0 L 4 24 Z" fill="#8d5f3c" />
    <circle cx="-9" cy="-2" r="17" fill="#3f8b45" />
    <circle cx="10" cy="2" r="15" fill="#4f9c4c" />
    <circle cx="0" cy="-14" r="16" fill="#61b357" />
    <circle cx="-5" cy="-19" r="8" fill="#7fca6d" opacity="0.85" />
  </g>
);

const MapTerrain = () => (
  <svg className="map-terrain" viewBox="0 0 1300 700" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a8d873" />
        <stop offset="100%" stopColor="#7fbc55" />
      </linearGradient>
      <linearGradient id="gLake" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor="#9adcf2" />
        <stop offset="100%" stopColor="#63b6dd" />
      </linearGradient>
      <filter id="fSoft" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="fHaze" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
      <filter id="fEdge" x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
    </defs>

    {/* Wiese: warme Grundfläche mit weichen Sonnenflecken */}
    <rect width="1300" height="700" fill="url(#gGrass)" />
    <ellipse cx="330" cy="250" rx="300" ry="190" fill="#c6e58c" opacity="0.42" filter="url(#fHaze)" />
    <ellipse cx="980" cy="470" rx="330" ry="210" fill="#c0e488" opacity="0.3" filter="url(#fHaze)" />
    <ellipse cx="640" cy="640" rx="360" ry="140" fill="#6faa4b" opacity="0.28" filter="url(#fHaze)" />

    {/* ── Wald oben links ── */}
    <ellipse cx="86"  cy="150" rx="96" ry="80" fill="#3f8b45" />
    <ellipse cx="150" cy="106" rx="72" ry="60" fill="#54a552" />
    <ellipse cx="42"  cy="196" rx="58" ry="50" fill="#478f47" />
    <ellipse cx="196" cy="156" rx="50" ry="44" fill="#63b45c" />
    <ellipse cx="132" cy="88"  rx="40" ry="30" fill="#7cc76c" opacity="0.75" />

    {/* ── Wald oben rechts ── */}
    <ellipse cx="1246" cy="128" rx="86" ry="72" fill="#3f8b45" />
    <ellipse cx="1188" cy="160" rx="60" ry="52" fill="#54a552" />
    <ellipse cx="1276" cy="200" rx="50" ry="44" fill="#478f47" />
    <ellipse cx="1240" cy="104" rx="40" ry="28" fill="#7cc76c" opacity="0.7" />

    {/* ── Wäldchen in der Mitte ── */}
    <ellipse cx="648" cy="498" rx="52" ry="44" fill="#4a9c4e" opacity="0.6" />
    <ellipse cx="686" cy="472" rx="38" ry="34" fill="#5cb058" opacity="0.6" />

    {/* ── See unten rechts ── */}
    <ellipse cx="960" cy="598" rx="228" ry="128" fill="#4f9dc4" opacity="0.45" filter="url(#fSoft)" />
    <ellipse cx="960" cy="598" rx="216" ry="118" fill="url(#gLake)" />
    <ellipse cx="960" cy="598" rx="216" ry="118" fill="none" stroke="#e8f6fb" strokeWidth="4" opacity="0.55" />
    <ellipse cx="912" cy="578" rx="58" ry="7" fill="white" opacity="0.5" transform="rotate(-9 912 578)" />
    <ellipse cx="1016" cy="610" rx="40" ry="5" fill="white" opacity="0.45" transform="rotate(6 1016 610)" />
    <ellipse cx="946" cy="630" rx="28" ry="4" fill="white" opacity="0.4" />
    <g stroke="#4f8f3f" strokeWidth="4" strokeLinecap="round" fill="none">
      <path d="M 758 560 q -6 -26 2 -40 M 768 564 q 2 -30 12 -42 M 778 562 q 8 -24 20 -34" />
      <path d="M 1170 580 q 6 -26 -2 -40 M 1160 584 q -2 -30 -12 -42" />
    </g>

    {/* ── Dorfplatz ── */}
    <ellipse cx="155" cy="614" rx="134" ry="90" fill="#e3caa0" />
    <ellipse cx="155" cy="614" rx="134" ry="90" fill="none" stroke="#c7a778" strokeWidth="4" />
    <g fill="#d3b489" opacity="0.85">
      <ellipse cx="96"  cy="590" rx="15" ry="8" /><ellipse cx="140" cy="580" rx="13" ry="7" />
      <ellipse cx="188" cy="592" rx="16" ry="8" /><ellipse cx="234" cy="608" rx="13" ry="7" />
      <ellipse cx="112" cy="634" rx="16" ry="8" /><ellipse cx="166" cy="646" rx="14" ry="7" />
      <ellipse cx="220" cy="638" rx="12" ry="6" /><ellipse cx="66"  cy="618" rx="13" ry="7" />
    </g>

    {/* ── Schulhof ── */}
    <rect x="298" y="72" width="392" height="322" rx="24" fill="#b6dfa8" opacity="0.35" filter="url(#fSoft)" />

    {/* ================================================================
        WEGE — getretener Pfad, keine Straße: weiche Erdaura statt harter
        Kante, Kreuzungen als kleine Lichtung, im Inneren nur gestreute
        Erdflecken. Jede durchgehende Längslinie sähe wieder nach Fahrbahn aus.
        ================================================================ */}

    {/* Kreuzungslichtungen, damit die Wege ineinander laufen statt sich zu schneiden */}
    <g fill="#cfae7e" opacity="0.9" filter="url(#fEdge)">
      <ellipse cx="482" cy="414" rx="46" ry="30" />
      <ellipse cx="318" cy="408" rx="38" ry="26" />
      <ellipse cx="96"  cy="418" rx="38" ry="26" />
      <ellipse cx="778" cy="176" rx="32" ry="22" />
      <ellipse cx="966" cy="254" rx="30" ry="22" />
      <ellipse cx="542" cy="192" rx="30" ry="22" />
    </g>

    {PATHS.map(p => (
      <path key={`aura-${p.d}`} d={p.d} stroke="#cfae7e" strokeWidth={p.w + 16}
            fill="none" strokeLinecap="round" filter="url(#fEdge)" opacity="0.9" />
    ))}
    {PATHS.map(p => (
      <path key={`fill-${p.d}`} d={p.d} stroke="#e6d3a8" strokeWidth={p.w}
            fill="none" strokeLinecap="round" />
    ))}
    {PATHS.map(p => (
      <path key={`core-${p.d}`} d={p.d} stroke="#f2e4c2" strokeWidth={p.w * 0.5}
            fill="none" strokeLinecap="round" opacity="0.45" filter="url(#fEdge)" />
    ))}

    {/* Großflächige, unscharfe Tonwertwechsel — heller und dunkler, ohne Kante */}
    <g opacity="0.28" filter="url(#fEdge)">
      <ellipse cx="180" cy="408" rx="30" ry="11" fill="#c7a878" />
      <ellipse cx="520" cy="420" rx="34" ry="12" fill="#f4e8c8" />
      <ellipse cx="880" cy="408" rx="32" ry="11" fill="#c7a878" />
      <ellipse cx="1150" cy="406" rx="28" ry="10" fill="#f4e8c8" />
      <ellipse cx="122" cy="500" rx="11" ry="24" fill="#c7a878" />
      <ellipse cx="476" cy="300" rx="12" ry="26" fill="#f4e8c8" />
      <ellipse cx="986" cy="390" rx="10" ry="22" fill="#c7a878" />
    </g>

    {/* Erdflecken */}
    {PATH_SPECKS.map(([x, y, rx, ry, rot, fill], i) => (
      <ellipse key={`sp${i}`} cx={x} cy={y} rx={rx} ry={ry} fill={fill}
               transform={`rotate(${rot} ${x} ${y})`} />
    ))}

    {/* Grasbüschel über den Wegrändern */}
    <g stroke="#6ba646" strokeWidth="3.5" strokeLinecap="round" fill="none">
      {PATH_TUFTS.map(([x, y], i) => (
        <path key={`tu${i}`} d={`M ${x} ${y} q 4 -12 8 -2 M ${x + 12} ${y + 2} q 5 -14 9 -3`} />
      ))}
    </g>

    {/* Bäume */}
    {TREE_SPOTS.map((t, i) => <MapTree key={`tr${i}`} x={t.x} y={t.y} s={t.s} />)}

    {/* Bambushain des Pandas */}
    {BAMBOO_SPOTS.map((b, i) => <MapBamboo key={`bb${i}`} x={b.x} y={b.y} h={b.h} lean={b.lean} />)}
  </svg>
);

// Building data
const BUILDINGS: {
  category: Category;
  label: string;
  icon: string;
  color: string;
  roofColor: string;
  shape: HouseShape;
  left: string;
  top: string;
}[] = [
  // Zone 1 – Rechendorf
  { category: 'plus',                 label: 'Plus-Haus',      icon: '➕', color: '#ef5350', roofColor: '#b71c1c', shape: 'cottage',  left: '9%',  top: '60%' },
  { category: 'minus',                label: 'Minus-Turm',     icon: '➖', color: '#42a5f5', roofColor: '#1565c0', shape: 'tower',    left: '19%', top: '55%' },
  { category: 'verdoppeln-halbieren', label: 'Spiegel-Haus',   icon: '🔄', color: '#66bb6a', roofColor: '#2e7d32', shape: 'barrel',   left: '13%', top: '79%' },
  // Zone 2 – Malviertel
  { category: 'einmaleins-klein',     label: '1×1 (bis 5)',    icon: '✖️', color: '#ab47bc', roofColor: '#6a1b9a', shape: 'cottage',  left: '37%', top: '25%' },
  { category: 'einmaleins-gross',     label: '1×1 (bis 10)',   icon: '✖️', color: '#7b1fa2', roofColor: '#4a148c', shape: 'twostory', left: '48%', top: '21%' },
  { category: 'einmaleins-tafel',     label: '1×1 Tafel',      icon: '📋', color: '#e91e63', roofColor: '#880e4f', shape: 'workshop', left: '43%', top: '41%' },
  { category: 'division',             label: 'Divisions-Haus', icon: '➗', color: '#1e88e5', roofColor: '#0d47a1', shape: 'twostory', left: '58%', top: '22%' },
  { category: 'division-zerlegen',    label: 'Zerlege-Werkstatt', icon: '🧩', color: '#00897b', roofColor: '#004d40', shape: 'workshop', left: '64%', top: '38%' },
  { category: 'division-rest',       label: 'Rest-Haus',      icon: '🍪', color: '#0097a7', roofColor: '#006064', shape: 'cottage',  left: '33%', top: '48%' },
  { category: 'kernaufgaben',         label: 'Kern-Trainer',   icon: '🔑', color: '#fb8c00', roofColor: '#e65100', shape: 'cottage',  left: '55%', top: '51%' },
  { category: 'tausch-arena',         label: 'Tausch-Arena',   icon: '🏡', color: '#43a047', roofColor: '#1b5e20', shape: 'barrel',   left: '45%', top: '62%' },
  // Zone 3 – Abenteuerviertel
  { category: 'sachaufgaben',         label: 'Rechen-Post',    icon: '✉️', color: '#f4511e', roofColor: '#bf360c', shape: 'cottage',  left: '70%', top: '21%' },
  { category: 'platzhalter',          label: 'Rätsel-Höhle',   icon: '🔍', color: '#8d6e63', roofColor: '#4e342e', shape: 'tower',    left: '80%', top: '37%' },
  { category: 'punkt-vor-strich',    label: 'Vorfahrt-Haus',  icon: '🚦', color: '#3949ab', roofColor: '#1a237e', shape: 'twostory', left: '88%', top: '48%' },
  { category: 'zahlen-fabrik',        label: 'Zahlen-Fabrik',  icon: '⚙️', color: '#546e7a', roofColor: '#263238', shape: 'workshop', left: '74%', top: '57%' },
  { category: 'uhrzeit',             label: 'Uhren-Turm',     icon: '⏰', color: '#6d4c41', roofColor: '#3e2723', shape: 'tower',    left: '27%', top: '38%' },
  { category: 'meister-zelt',         label: 'Meister-Zelt',   icon: '🏆', color: '#ffca28', roofColor: '#f57f17', shape: 'tent',     left: '84%', top: '67%' },
  { category: 'differenz-jagd',       label: 'Differenz-See',  icon: '🌊', color: '#29b6f6', roofColor: '#01579b', shape: 'barrel',   left: '69%', top: '80%' },
  { category: 'zahlen-mauer',         label: 'Zahlen-Mauer',   icon: '🧱', color: '#a1887f', roofColor: '#4e342e', shape: 'twostory', left: '83%', top: '81%' },
];

// ── Gezeichnete Häuser ──
// Alle Bauformen teilen sich das Innere (Schild mit Zeichen, Tür, Fenster);
// unterschieden werden sie über die Silhouette — das ist es, was auf
// Kartengröße überhaupt erkennbar bleibt.

const WOOD = '#8d5a3b';
const WOOD_FACE = '#c99a63';
const GLASS = '#ffe9a8';

// Schild mit dem Zeichen der Aufgabenart — ersetzt das direkt auf die Wand
// geklebte Emoji, bleibt aber als Erkennungsmerkmal für Leseanfänger erhalten.
const HouseSign = ({ icon, y = 72, w = 32, h = 24 }: { icon: string; y?: number; w?: number; h?: number }) => (
  <g>
    <rect x={60 - w / 2} y={y} width={w} height={h} rx="3" fill={WOOD} />
    <rect x={60 - w / 2 + 2.5} y={y + 2.5} width={w - 5} height={h - 5} rx="2" fill={WOOD_FACE} />
    <text x="60" y={y + h / 2 + h * 0.3} textAnchor="middle" fontSize={h * 0.8}>{icon}</text>
  </g>
);

const HouseDoor = ({ x = 52, y = 102, w = 16, h = 24 }: { x?: number; y?: number; w?: number; h?: number }) => (
  <g>
    <path d={`M ${x} ${y + h} L ${x} ${y + 7} q 0 -7 ${w / 2} -7 q ${w / 2} 0 ${w / 2} 7 L ${x + w} ${y + h} Z`} fill={WOOD} />
    <circle cx={x + w - 4} cy={y + h * 0.55} r="1.8" fill="#ffd77a" />
  </g>
);

const HouseWindow = ({ x, y, w = 14, h = 14 }: { x: number; y: number; w?: number; h?: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="2.5" fill={GLASS} stroke={WOOD} strokeWidth="2.5" />
    <path d={`M ${x + w / 2} ${y} L ${x + w / 2} ${y + h} M ${x} ${y + h / 2} L ${x + w} ${y + h / 2}`} stroke={WOOD} strokeWidth="1.8" />
  </g>
);

type HouseShape = 'cottage' | 'tower' | 'twostory' | 'workshop' | 'barrel' | 'tent';

const HouseArt = ({ shape, color, roofColor, icon }: { shape: HouseShape; color: string; roofColor: string; icon: string }) => (
  <svg className="mb-svg" viewBox="0 0 120 140" preserveAspectRatio="xMidYMax meet">
    <ellipse cx="63" cy="126" rx="44" ry="8" fill="#4a7f38" opacity="0.3" />

    {shape === 'tent' ? (
      <>
        <path d="M 60 18 L 112 126 L 8 126 Z" fill={color} />
        <path d="M 60 18 L 60 126 L 8 126 Z" fill="#fff" opacity="0.13" />
        <path d="M 60 18 L 78 126 L 62 126 Z" fill={roofColor} opacity="0.55" />
        <path d="M 60 18 L 42 126 L 58 126 Z" fill={roofColor} opacity="0.35" />
        <path d="M 60 12 L 60 22" stroke={WOOD} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 62 12 L 84 18 L 62 24 Z" fill="#ffca28" />
        <path d="M 48 126 L 54 96 q 6 -8 12 0 L 72 126 Z" fill="#4a2f1e" />
        <HouseSign icon={icon} y={60} w={30} h={24} />
      </>
    ) : shape === 'tower' ? (
      <>
        <path d="M 36 126 L 36 52 q 0 -5 5 -5 L 79 47 q 5 0 5 5 L 84 126 Z" fill={color} />
        <path d="M 68 48 L 84 52 L 84 126 L 68 126 Z" fill="#000" opacity="0.13" />
        <rect x="33" y="40" width="54" height="10" rx="4" fill={roofColor} opacity="0.75" />
        <path d="M 28 42 L 60 16 L 92 42 Z" fill={roofColor} />
        <path d="M 28 42 L 60 16 L 60 42 Z" fill="#fff" opacity="0.13" />
        <path d="M 60 16 L 60 4" stroke={WOOD} strokeWidth="3" strokeLinecap="round" />
        <path d="M 62 5 L 84 10 L 62 15 Z" fill="#ffca28" />
        <HouseSign icon={icon} y={60} w={28} h={22} />
        <circle cx="60" cy="94" r="6.5" fill={GLASS} stroke={WOOD} strokeWidth="2.5" />
        <HouseDoor x={53} y={104} w={14} h={22} />
      </>
    ) : shape === 'twostory' ? (
      <>
        <path d="M 22 126 L 22 62 q 0 -6 6 -6 L 92 56 q 6 0 6 6 L 98 126 Z" fill={color} />
        <path d="M 80 58 L 98 62 L 98 126 L 80 126 Z" fill="#000" opacity="0.12" />
        <path d="M 10 64 L 60 18 L 110 64 q 3 4 -3 4 L 13 68 q -6 0 -3 -4 Z" fill={roofColor} />
        <path d="M 10 64 L 60 18 L 60 68 L 13 68 q -6 0 -3 -4 Z" fill="#fff" opacity="0.12" />
        <g stroke="#000" strokeWidth="2" opacity="0.16" strokeLinecap="round">
          <path d="M 20 60 L 100 60" /><path d="M 32 48 L 88 48" />
        </g>
        <rect x="22" y="94" width="76" height="3" fill="#000" opacity="0.12" />
        <HouseWindow x={30} y={72} w={13} h={13} />
        <HouseWindow x={77} y={72} w={13} h={13} />
        <HouseSign icon={icon} y={99} w={30} h={22} />
        <HouseDoor x={26} y={104} w={14} h={22} />
      </>
    ) : shape === 'workshop' ? (
      <>
        <rect x="24" y="26" width="13" height="28" rx="3" fill={roofColor} />
        <rect x="21" y="22" width="19" height="9" rx="4" fill={roofColor} opacity="0.8" />
        <path d="M 24 126 L 24 78 L 96 66 L 96 126 Z" fill={color} />
        <path d="M 80 68 L 96 66 L 96 126 L 80 126 Z" fill="#000" opacity="0.12" />
        <path d="M 12 78 L 108 62 L 108 74 L 12 90 Z" fill={roofColor} />
        <path d="M 12 78 L 108 62 L 108 67 L 12 83 Z" fill="#fff" opacity="0.12" />
        <HouseSign icon={icon} y={92} w={30} h={22} />
        <HouseWindow x={28} y={94} w={13} h={13} />
        <HouseWindow x={80} y={90} w={13} h={13} />
        <HouseDoor x={52} y={116} w={16} h={10} />
      </>
    ) : shape === 'barrel' ? (
      <>
        <path d="M 26 126 L 26 74 q 0 -6 6 -6 L 88 68 q 6 0 6 6 L 94 126 Z" fill={color} />
        <path d="M 76 70 L 94 74 L 94 126 L 76 126 Z" fill="#000" opacity="0.12" />
        <path d="M 14 72 q 46 -50 92 0 q 2 4 -4 4 L 18 76 q -6 0 -4 -4 Z" fill={roofColor} />
        <path d="M 14 72 q 23 -25 46 -30 L 60 76 L 18 76 q -6 0 -4 -4 Z" fill="#fff" opacity="0.13" />
        <HouseWindow x={30} y={82} w={13} h={13} />
        <HouseWindow x={77} y={82} w={13} h={13} />
        <HouseSign icon={icon} y={78} w={28} h={22} />
        <HouseDoor x={52} y={104} w={16} h={22} />
      </>
    ) : (
      <>
        <rect x="74" y="24" width="13" height="28" rx="3" fill={roofColor} />
        <rect x="71" y="20" width="19" height="9" rx="4" fill={roofColor} opacity="0.8" />
        <g fill="#fff" opacity="0.55">
          <circle cx="90" cy="14" r="5" /><circle cx="99" cy="6" r="5" />
        </g>
        <path d="M 24 126 L 24 74 q 0 -6 6 -6 L 90 68 q 6 0 6 6 L 96 126 Z" fill={color} />
        <path d="M 78 70 L 96 74 L 96 126 L 78 126 Z" fill="#000" opacity="0.12" />
        <path d="M 12 70 L 60 30 L 108 70 q 3 4 -3 4 L 15 74 q -6 0 -3 -4 Z" fill={roofColor} />
        <path d="M 12 70 L 60 30 L 60 74 L 15 74 q -6 0 -3 -4 Z" fill="#fff" opacity="0.12" />
        <g stroke="#000" strokeWidth="2" opacity="0.18" strokeLinecap="round">
          <path d="M 22 66 L 98 66" /><path d="M 34 54 L 86 54" /><path d="M 46 42 L 74 42" />
        </g>
        <HouseWindow x={29} y={80} w={13} h={13} />
        <HouseWindow x={78} y={80} w={13} h={13} />
        <HouseSign icon={icon} y={76} w={28} h={22} />
        <HouseDoor x={52} y={102} w={16} h={24} />
      </>
    )}
  </svg>
);

interface MapBuildingProps {
  label: string; icon: string; color: string; roofColor: string; shape: HouseShape;
  stickers: string[]; left: string; top: string; onClick: () => void;
}

const MapBuilding = ({ label, icon, color, roofColor, shape, stickers, left, top, onClick }: MapBuildingProps) => (
  <div className="map-building" style={{ left, top }} onClick={onClick}>
    <div className="mb-art">
      {stickers.length > 0 && (
        <div className="mb-badge">
          <Star size={9} fill="#f59e0b" stroke="none" />
          {stickers.length}
        </div>
      )}
      <HouseArt shape={shape} color={color} roofColor={roofColor} icon={icon} />
    </div>
    <div className="mb-label">{label}</div>
  </div>
);

// ── Shared game UI ──

const GameHeader = ({ category, onBack }: { category: Category; onBack: () => void }) => {
  const b = BUILDINGS.find(b => b.category === category)!;
  return (
    <div className="game-header" style={{ background: b.color }}>
      <button className="back-button-small" onClick={onBack}><ArrowLeft size={20} /></button>
      <span className="game-header-icon">{b.icon}</span>
      <span className="game-header-title">{b.label}</span>
    </div>
  );
};

const StarProgress = ({ solved, total }: { solved: number; total: number }) => (
  <div className="star-progress">
    {Array.from({ length: total }, (_, i) => (
      <Star key={i} size={28}
        fill={i < solved ? '#f59e0b' : 'none'}
        stroke={i < solved ? '#f59e0b' : '#d1d5db'}
        strokeWidth={i < solved ? 0 : 2}
      />
    ))}
  </div>
);

// ============================================================
// GAME COMPONENTS
// ============================================================

const NumberWall = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [wall, setWall] = useState<number[] | null>(null);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [solvedCount, setSolvedCount] = useState(0);
  // Die Mauer hat mehrere offene Steine — gesteuert wird ueber den Index, nicht
  // ueber eine feste Ref. Der Fokus wandert nur bei neuer Mauer und nach einem
  // richtigen Stein weiter, sonst wuerde er einem angeklickten Stein
  // hinterherspringen.
  const brickRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  useEffect(() => { if (focusIdx !== null) brickRefs.current[focusIdx]?.focus(); }, [focusIdx, wall]);

  const generateWall = () => {
    const b1 = randInt(1, 10);
    const b2 = randInt(1, 10);
    const b3 = randInt(1, 10);
    const fullWall = [b1 + b2 + b2 + b3, b1 + b2, b2 + b3, b1, b2, b3];
    const relations: [number, number, number][] = [[0, 1, 2], [1, 3, 4], [2, 4, 5]];
    const isSolvable = (hidden: number[]) => {
      const known = [0, 1, 2, 3, 4, 5].filter(i => !hidden.includes(i));
      let changed = true;
      while (changed) {
        changed = false;
        for (const [s, p1, p2] of relations) {
          const tri = [s, p1, p2];
          if (tri.filter(i => known.includes(i)).length === 2) {
            const m = tri.find(i => !known.includes(i))!;
            if (!known.includes(m)) { known.push(m); changed = true; }
          }
        }
      }
      return known.length === 6;
    };
    let hidden: number[];
    do { hidden = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3); } while (!isSolvable(hidden));
    setWall(fullWall);
    setInputs(hidden.reduce((acc, idx) => ({ ...acc, [idx]: '' }), {}));
    setFocusIdx(Math.min(...hidden));
  };

  useEffect(() => generateWall(), []);

  const check = (idx: number, val: string) => {
    const newInputs = { ...inputs, [idx]: val };
    setInputs(newInputs);
    if (parseInt(val) === wall![idx]) {
      playSound('correct');
      const offen = Object.keys(newInputs).map(Number).filter(k => parseInt(newInputs[k]) !== wall![k]);
      if (offen.length === 0) {
        setTimeout(() => {
          setSolvedCount(c => c + 1);
          if (solvedCount + 1 >= 3) onWin('🏰');
          else generateWall();
        }, 800);
      } else setFocusIdx(Math.min(...offen));
    }
  };

  if (!wall) return null;
  return (
    <div className="game-page" style={{ background: '#e0f7fa' }}>
      <GameHeader category="zahlen-mauer" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#ff9800', zIndex: 10 } as any}>
        <StarProgress solved={solvedCount} total={3} />
        <div style={{ marginBottom: '20px', fontWeight: 'bold' }}>Zwei Steine unten ergeben den Stein darüber! 🧱</div>
        <div className="wall-grid">
          <div className="wall-row">
            <div className="brick">{inputs[0] !== undefined ? <input ref={el => { brickRefs.current[0] = el; }} type="number" value={inputs[0]} onChange={e => check(0, e.target.value)} className="brick-input" /> : wall[0]}</div>
          </div>
          <div className="wall-row" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-15px' }}>➕</div>
            {[1, 2].map(i => <div key={i} className="brick">{inputs[i] !== undefined ? <input ref={el => { brickRefs.current[i] = el; }} type="number" value={inputs[i]} onChange={e => check(i, e.target.value)} className="brick-input" /> : wall[i]}</div>)}
          </div>
          <div className="wall-row" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-15px', left: '25%' }}>➕</div>
            <div style={{ position: 'absolute', top: '-15px', right: '25%' }}>➕</div>
            {[3, 4, 5].map(i => <div key={i} className="brick">{inputs[i] !== undefined ? <input ref={el => { brickRefs.current[i] = el; }} type="number" value={inputs[i]} onChange={e => check(i, e.target.value)} className="brick-input" /> : wall[i]}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

const DifferenceHunt = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [nums, setNums] = useState({ a: 0, b: 0, diff: 0 });
  const [bubbles, setBubbles] = useState<{ id: number; val: number; x: number; y: number; vx: number; vy: number }[]>([]);
  const [solvedCount, setSolvedCount] = useState(0);
  const req = useRef<number | null>(null);

  const spawn = () => {
    // Die Differenz lag frueher immer zwischen 1 und 5. Bei sechs Blasen aus
    // 1..15 war die richtige damit fast immer die kleinste — das Spiel liess
    // sich erraten, ohne zu rechnen. Jetzt reicht sie bis 12.
    // Gesperrt wird die Differenz, nicht das Zahlenpaar: 17/23 und 24/30 sind
    // fuer das Kind dieselbe Uebung, wenn beide Male 6 herauskommt.
    const d = drawFresh('differenz-see', 4, () => randInt(2, 12), x => String(x));
    const a = randInt(Math.max(5, d + 1), 30);
    const b = Math.random() < 0.5 ? a + d : a - d;
    setNums({ a, b, diff: Math.abs(a - b) });
    // Ablenker liegen dicht um die Loesung herum, damit wirklich gerechnet
    // werden muss statt nach der auffaelligsten Zahl zu greifen.
    const pool = [d];
    while (pool.length < 6) {
      const v = d + randInt(-4, 4);
      if (v >= 1 && !pool.includes(v)) pool.push(v);
    }
    setBubbles(shuffle(pool).map(v => ({ id: Math.random(), val: v, x: Math.random() * 80 + 10, y: Math.random() * 60 + 20, vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1 })));
  };
  useEffect(() => spawn(), []);
  const anim = () => { setBubbles(prev => prev.map(b => { let nx = b.x + b.vx, ny = b.y + b.vy, nvx = b.vx, nvy = b.vy; if (nx < 5 || nx > 90) nvx *= -1; if (ny < 15 || ny > 85) nvy *= -1; return { ...b, x: nx, y: ny, vx: nvx, vy: nvy }; })); req.current = requestAnimationFrame(anim); };
  useEffect(() => { req.current = requestAnimationFrame(anim); return () => cancelAnimationFrame(req.current!); }, []);

  return (
    <div className="village lake-landscape" style={{ justifyContent: 'center', paddingTop: '80px' }}>
      <GameHeader category="differenz-jagd" onBack={onBack} />
      <div className="water-waves"></div>
      <div className="textbook-ui" style={{ zIndex: 10 }}>
        <div className="number-box">{nums.a}</div>
        <div className="gap-arrow"><div className="gap-label">Wie viel fehlt?</div><div className="arrow-line"></div></div>
        <div className="number-box">{nums.b}</div>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '45vh', zIndex: 10 }}>
        {bubbles.map(b => (
          <div key={b.id} className="bubble" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => {
            if (b.val === nums.diff) {
              playSound('correct');
              setSolvedCount(c => c + 1);
              if (solvedCount + 1 >= 3) onWin('🎈');
              else spawn();
            } else { playSound('wrong'); setBubbles(prev => prev.filter(nb => nb.id !== b.id)); }
          }}>{b.val}</div>
        ))}
      </div>
      <div style={{ zIndex: 10 }}><StarProgress solved={solvedCount} total={3} /></div>
    </div>
  );
};

const FactoryGame = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  // Ziele von 10..19 bedeuteten nur zehn verschiedene Runden; jede vierte
  // 3er-Runde enthielt dasselbe Ziel zweimal.
  const rollTarget = () => drawFresh('fabrik-ziel', 6, () => randInt(11, 29), x => String(x));
  const [target, setTarget] = useState(rollTarget);
  const [grid, setGrid] = useState<({ id: number; val: number } | null)[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [solved, setSolved] = useState(0);
  const fill = (ex: ({ id: number; val: number } | null)[] = []) => { const n = [...ex]; for (let i = 0; i < 25; i++) if (!n[i]) n[i] = { id: Math.random(), val: randInt(1, 9) }; return n; };
  useEffect(() => setGrid(fill()), []);
  const click = (idx: number) => {
    if (sel.includes(idx)) { setSel(p => p.filter(i => i !== idx)); return; }
    const ns = [...sel, idx]; const sum = ns.reduce((s, i) => s + (grid[i]?.val || 0), 0);
    if (sum === target) {
      playSound('correct');
      const ng = [...grid]; ns.forEach(i => { ng[i] = null; }); setGrid(fill(ng)); setSel([]);
      setSolved(c => c + 1);
      if (solved + 1 >= 5) onWin('⚙️');
      else setTarget(rollTarget());
    } else if (sum > target) { playSound('wrong'); setSel([]); } else setSel(ns);
  };
  return (
    <div className="game-page" style={{ background: '#1a1a1a' }}>
      <GameHeader category="zahlen-fabrik" onBack={onBack} />
      <div className="factory-terminal">
        <div className="terminal-header"><div className="target-display">ZIEL: {target}</div><div className="current-sum-display">SUMME: {sel.reduce((s, i) => s + (grid[i]?.val || 0), 0)}</div></div>
        <div className="number-grid">{grid.map((n, i) => <div key={n?.id || i} className={`grid-cell ${sel.includes(i) ? 'selected' : ''}`} onClick={() => click(i)}>{n?.val}</div>)}</div>
        <StarProgress solved={solved} total={5} />
      </div>
    </div>
  );
};

const ComparisonGame = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [ops, setOps] = useState<{ q: string; v: number; e: string }[]>([]);
  const [solved, setSolved] = useState(0);
  const animals = ['🐱', '🐶', '🦊', '🦁', '🐼'];
  const gen = () => setOps([0, 1, 2].map(i => { const a = Math.floor(Math.random() * 10) + 1; const b = Math.floor(Math.random() * 10) + 1; return { q: `${a}+${b}`, v: a + b, e: animals[i] }; }));
  useEffect(() => gen(), []);
  const click = (v: number) => {
    if (v === Math.max(...ops.map(o => o.v))) {
      playSound('correct');
      setSolved(c => c + 1);
      if (solved + 1 >= 3) onWin('🏆');
      else gen();
    } else playSound('wrong');
  };
  return (
    <div className="game-page" style={{ background: '#fff9c4' }}>
      <GameHeader category="meister-zelt" onBack={onBack} />
      <div className="game-container">
        <h2>Wer hat das höchste Ergebnis?</h2>
        <div className="comparison-arena">{ops.map((o, i) => <div key={i} className="animal-contestant" onClick={() => click(o.v)}><div className="math-sign">{o.q}</div><div className="contestant-emoji">{o.e}</div></div>)}</div>
        <StarProgress solved={solved} total={3} />
      </div>
    </div>
  );
};

const MultiplicationTafel = ({ grid, onWin, onBack, onMarkCell }: { grid: Record<string, boolean>; onWin: (s: string) => void; onBack: () => void; onMarkCell: (key: string) => void }) => {
  const [solved, setSolved] = useState(0);
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<{ a: number; b: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, [problem]);
  const nextProblem = (g: Record<string, boolean>) => { const av: { a: number; b: number }[] = []; for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) if (!g[`${a}x${b}`]) av.push({ a, b }); return av.length > 0 ? av[Math.floor(Math.random() * av.length)] : null; };
  useEffect(() => setProblem(nextProblem(grid)), []);
  const check = (val: string) => {
    const n = parseInt(val); if (isNaN(n) || !problem) return;
    if (n === problem.a * problem.b) {
      playSound('correct'); onMarkCell(`${problem.a}x${problem.b}`);
      const ng = { ...grid, [`${problem.a}x${problem.b}`]: true };
      setTimeout(() => {
        setSolved(s => s + 1);
        if (solved + 1 >= 5) onWin('🎨');
        else { setProblem(nextProblem(ng)); setInput(''); }
      }, 600);
    } else if (val.length >= (problem.a * problem.b).toString().length) { playSound('wrong'); setInput(''); }
  };
  const axis = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="game-page" style={{ background: '#fce4ec' }}>
      <GameHeader category="einmaleins-tafel" onBack={onBack} />
      <div className="tafel-layout">
        <div className="tafel-grid">
          <div className="tafel-cell header">×</div>
          {axis.map(x => <div key={`h${x}`} className="tafel-cell header">{x}</div>)}
          {axis.map(y => (<React.Fragment key={`row${y}`}><div className="tafel-cell header">{y}</div>{axis.map(x => (<div key={`${x}x${y}`} className={`tafel-cell ${grid[`${x}x${y}`] ? 'filled' : ''} ${problem?.a === x && problem?.b === y ? 'active' : ''}`}>{grid[`${x}x${y}`] ? x * y : ''}</div>))}</React.Fragment>))}
        </div>
        <div className="game-container tafel-side">
          <h2>Fülle die Tafel! 🎨</h2>
          <div className="task" style={{ fontSize: '4rem' }}>{problem ? `${problem.a} × ${problem.b} = ?` : 'Fertig! 🎉'}</div>
          <input ref={inputRef} autoFocus className="input-field" type="number" value={input} onChange={e => { setInput(e.target.value); check(e.target.value); }} />
          <StarProgress solved={solved} total={5} />
        </div>
      </div>
    </div>
  );
};

const TauschArena = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [family, setFamily] = useState<{ a: number; b: number; p: number } | null>(null);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState('');
  const [done, setDone] = useState<number[]>([]);
  const [completed, setCompleted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, [family, step]);
  const genFamily = () => {
    // 4 x 7 und 7 x 4 sind dieselbe Aufgaben-Familie — deshalb wird die Sperre
    // ueber das sortierte Paar gefuehrt und nicht ueber a und b einzeln.
    const f = drawFresh('tausch-arena', 12,
      () => ({ a: randInt(2, 9), b: randInt(2, 9) }),
      ({ a, b }) => [a, b].sort((x, y) => x - y).join('x'));
    setFamily({ ...f, p: f.a * f.b }); setStep(0); setInput(''); setDone([]);
  };
  useEffect(() => genFamily(), []);
  const getSteps = (f: { a: number; b: number; p: number }) => [
    { label: `${f.b} × ${f.a} =`, answer: f.p },
    { label: `${f.p} ÷ ${f.a} =`, answer: f.b },
    { label: `${f.p} ÷ ${f.b} =`, answer: f.a },
  ];
  const check = (val: string) => {
    if (!family) return; const n = parseInt(val); if (isNaN(n)) return;
    const steps = getSteps(family);
    if (n === steps[step].answer) {
      playSound('correct'); const nd = [...done, step]; setDone(nd); setInput('');
      setTimeout(() => {
        if (nd.length >= 3) {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('🏠');
          else genFamily();
        } else setStep(s => s + 1);
      }, 600);
    } else if (val.length >= steps[step].answer.toString().length) { playSound('wrong'); setInput(''); }
  };
  if (!family) return null;
  const steps = getSteps(family);
  return (
    <div className="game-page" style={{ background: '#e8f5e9' }}>
      <GameHeader category="tausch-arena" onBack={onBack} />
      <div className="game-container">
        <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Ergänze alle Verwandten!</p>
        <div className="family-card">
          <div className="family-fact given"><span>{family.a} × {family.b} = {family.p}</span><span className="fact-check">✓</span></div>
          {steps.map((s, i) => (
            <div key={i} className={`family-fact ${done.includes(i) ? 'done' : i === step ? 'active-fact' : 'pending'}`}>
              <span>{s.label} {done.includes(i) ? <strong>{s.answer}</strong> : '?'}</span>
              {done.includes(i) && <span className="fact-check">✓</span>}
            </div>
          ))}
        </div>
        <input ref={inputRef} autoFocus className="input-field" type="number" value={input} onChange={e => { setInput(e.target.value); check(e.target.value); }} style={{ marginTop: '1.5rem' }} />
        <StarProgress solved={completed} total={3} />
      </div>
    </div>
  );
};

// ── Divisions-Spiel: 2 Eingaben pro Aufgabe (Division + denn-Herleitung) ──
const DivisionGame = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [fam, setFam] = useState<{ a: number; b: number; p: number; t: number } | null>(null);
  const [step, setStep] = useState(0);   // 0 = Division eingeben, 1 = denn eingeben
  const [input, setInput] = useState('');
  const [divSolved, setDivSolved] = useState(false);
  const [completed, setCompleted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, [fam, step]);

  const gen = () => {
    // Die Sperre ignoriert den Aufgabentyp: 63 : 7 zweimal hintereinander bleibt
    // dieselbe Rechnung, auch wenn einmal der Teiler und einmal das Ergebnis fehlt.
    const f = drawFresh('division-haus', 12,
      () => ({ a: randInt(2, 10), b: randInt(1, 10), t: randInt(0, 2) }),
      ({ a, b }) => `${a}/${b}`);
    const { a, b, t } = f;
    setFam({ a, b, p: a * b, t });
    setStep(0); setInput(''); setDivSolved(false);
  };
  useEffect(() => gen(), []);
  if (!fam) return null;

  const { a, b, p, t } = fam;

  // Division-Zeile: Frage und Antwort
  const divQ      = t === 0 ? `${p} : ${a} = ?`  : t === 1 ? `${p} : ? = ${b}` : `? : ${a} = ${b}`;
  const divFilled = `${p} : ${a} = ${b}`;          // nach Eingabe: vollständige Gleichung
  const divAns    = t === 0 ? b : t === 1 ? a : p;

  // denn-Zeile: Frage und Antwort (dieselbe fehlende Zahl)
  const dennQ   = t === 0 ? `denn  ? × ${a} = ${p}` : t === 1 ? `denn  ${b} × ? = ${p}` : `denn  ${b} × ${a} = ?`;
  const dennAns = divAns;

  const check = (val: string) => {
    const n = parseInt(val); if (isNaN(n)) return;
    const expected = step === 0 ? divAns : dennAns;
    if (n === expected) {
      playSound('correct'); setInput('');
      if (step === 0) {
        setDivSolved(true);
        setTimeout(() => setStep(1), 500);
      } else {
        setTimeout(() => {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('➗');
          else gen();
        }, 600);
      }
    } else if (val.length >= expected.toString().length) {
      playSound('wrong'); setInput('');
    }
  };

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #1e88e528 0%, #f5f8ff 100%)' }}>
      <GameHeader category="division" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#1e88e5' } as any}>
        <StarProgress solved={completed} total={3} />

        <div className="division-denn">
          {/* Zeile 1: Division */}
          <div className={`div-question ${divSolved ? 'div-line-done' : 'div-line-active'}`}>
            {divSolved ? divFilled : divQ}
            {divSolved && <span className="div-check">✓</span>}
          </div>

          {/* Zeile 2: denn — erscheint erst nach Schritt 1 */}
          {(divSolved || step === 1) && (
            <div className={`div-denn ${step === 1 ? 'div-line-active' : ''}`}>
              {dennQ}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          key={step}       /* remount → autoFocus beim Step-Wechsel */
          autoFocus
          className="input-field"
          type="number"
          value={input}
          onChange={e => { setInput(e.target.value); check(e.target.value); }}
        />

        <p className="div-hint">
          {step === 0 ? '➗ Trage die fehlende Zahl ein' : '× Jetzt die Herleitung ergänzen'}
        </p>
      </div>
    </div>
  );
};

// ── Halbschriftliche Division: Zerlegen in Zehner-Portion + Rest ──
// Zerlegt wird nicht stur bei der Zehnerstelle, sondern so, dass beide Teile ohne
// Rest aufgehen: 91 = 70 + 21 → 10 + 3 = 13. Bei glatten Aufgaben ist das genau
// die Zehner/Einer-Zerlegung (84 = 80 + 4), sonst deutlich mehr Aufgaben-Vielfalt.
interface ZerlegeTask {
  n: number; d: number;     // Aufgabe: n : d
  p1: number; p2: number;   // die beiden Teil-Dividenden (70 / 21)
  a1: number; a2: number;   // die beiden Teil-Ergebnisse  (10 /  3)
}

const ZERLEGE_TASKS: ZerlegeTask[] = (() => {
  const list: ZerlegeTask[] = [];
  // Teiler 8 und 9 bleiben draußen: bei 2-stelligen Dividenden gibt es dafür nur
  // ein bis zwei saubere Zerlegungen — die würden sich ständig wiederholen.
  for (let d = 2; d <= 7; d++) {
    for (let q = 11; q * d <= 99; q++) {
      if (q % 10 === 0) continue;      // sonst wäre die zweite Zeile 0 : d = 0
      const a1 = Math.floor(q / 10) * 10, a2 = q % 10;
      list.push({ n: d * q, d, p1: d * a1, p2: d * a2, a1, a2 });
    }
  }
  return list;
})();

const ZerlegeDivision = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [task, setTask] = useState<ZerlegeTask | null>(null);
  const lastIdx = useRef(-1);
  const [vals, setVals] = useState(['', '']);
  const [done, setDone] = useState([false, false]);
  const [wrong, setWrong] = useState([false, false]);
  const [completed, setCompleted] = useState(0);
  const advancing = useRef(false);       // blockt Tippen während der Pause zur nächsten Aufgabe
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1];

  const gen = () => {
    let idx = lastIdx.current;
    while (idx === lastIdx.current) idx = Math.floor(Math.random() * ZERLEGE_TASKS.length);
    lastIdx.current = idx;
    setTask(ZERLEGE_TASKS[idx]);
    setVals(['', '']); setDone([false, false]); setWrong([false, false]);
    advancing.current = false;
    setTimeout(() => ref0.current?.focus(), 0);
  };
  useEffect(() => gen(), []);
  // Nach dem ersten richtigen Teil wandert der Fokus in die zweite Zeile.
  useAutoFocus(done[0] && !done[1] ? ref1 : ref0, [task, done[0], done[1]]);
  if (!task) return null;

  const { n, d, p1, p2 } = task;
  const answers = [task.a1, task.a2];
  const allDone = done[0] && done[1];

  const type = (i: number, val: string) => {
    if (done[i] || advancing.current) return;
    setVals(v => v.map((x, k) => (k === i ? val : x)));

    const num = parseInt(val); if (isNaN(num)) return;

    if (num === answers[i]) {
      playSound('correct');
      const nd = done.map((x, k) => (k === i ? true : x));
      setDone(nd);
      if (nd[0] && nd[1]) {
        advancing.current = true;
        setTimeout(() => {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('🧩');
          else gen();
        }, 1400);                              // Zeit, das Ergebnis oben zu sehen
      } else {
        setTimeout(() => refs[1 - i].current?.focus(), 0);
      }
    } else if (val.length >= answers[i].toString().length) {
      // Falsches erst stehen lassen, dann in einem eigenen Tick löschen — ein Reset
      // im selben Event würde von React verschluckt (gleicher Wert wie zuvor).
      playSound('wrong');
      setWrong(w => w.map((x, k) => (k === i ? true : x)));
      setTimeout(() => {
        setVals(v => v.map((x, k) => (k === i ? '' : x)));
        setWrong(w => w.map((x, k) => (k === i ? false : x)));
        refs[i].current?.focus();
      }, 450);
    }
  };

  const row = (i: number, left: number) => (
    <div className={`zl-row ${done[i] ? 'done' : wrong[i] ? 'wrong' : 'active'}`}>
      <span className="zl-calc">{left} : {d} =</span>
      <input
        ref={refs[i]}
        className="zl-input"
        type="number"
        value={vals[i]}
        readOnly={done[i]}
        onChange={e => type(i, e.target.value)}
      />
      {done[i] && <span className="zl-check">✓</span>}
    </div>
  );

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #00897b28 0%, #f5fffd 100%)' }}>
      <GameHeader category="division-zerlegen" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#00897b' } as any}>
        <StarProgress solved={completed} total={3} />

        <div className={`zl-task ${allDone ? 'solved' : ''}`}>
          {n} : {d} = <span className="zl-result">{allDone ? answers[0] + answers[1] : '?'}</span>
        </div>
        <div className="zl-split">Zerlege: {n} = <b>{p1}</b> + <b>{p2}</b></div>

        <div className="zl-rows">
          {row(0, p1)}
          {row(1, p2)}
          <div className={`zl-sum ${allDone ? 'shown' : ''}`}>
            {allDone ? `${answers[0]} + ${answers[1]} = ${answers[0] + answers[1]}` : ' '}
          </div>
        </div>

        <p className="div-hint">
          {allDone
            ? '🎉 Beide Teile stimmen — zusammen ergibt das die Lösung!'
            : `🧩 Teile ${p1} und ${p2} einzeln durch ${d}`}
        </p>
      </div>
    </div>
  );
};

// ── Teilen mit Rest: Aufgabe eingeben, danach das Bild dazu ──
// Gezeigt wird das AUFTEILEN: 23 : 7 heisst "wie oft passt 7 in 23?" — also
// Rahmen zu je 7 Kaestchen. Die Zahl der Rahmen ist das Ergebnis, der letzte
// Rahmen ist der Rest. Die andere Lesart (23 auf 7 Kinder verteilen) ergibt
// dieselben Zahlen, aber ein Bild, in dem das Ergebnis nirgends abzuzaehlen ist.
interface RestTask { n: number; d: number; q: number; r: number; }

// Ergebnis hoechstens 6, damit das Bild nie mehr als sieben Zeilen hoch wird —
// auf dem Handy muss es ohne Scrollen unter die Aufgabe passen.
const rollRestTask = (): RestTask => {
  const d = randInt(2, 9);
  const q = randInt(2, 6);
  const r = randInt(1, d - 1);   // nie 0: das Haus uebt genau den Rest
  return { n: d * q + r, d, q, r };
};

const RestHaus = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [task, setTask] = useState<RestTask | null>(null);
  const [vals, setVals] = useState(['', '']);
  const [done, setDone] = useState([false, false]);
  const [wrong, setWrong] = useState([false, false]);
  const [note, setNote] = useState('');        // Sonderhinweis, z.B. Rest zu gross
  const [completed, setCompleted] = useState(0);
  const [helped, setHelped] = useState(false);
  const [helpReady, setHelpReady] = useState(false);
  const [revealed, setRevealed] = useState(0); // wie viele Rahmen schon gezeichnet sind
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1];

  const gen = () => {
    const t = drawFresh('rest-haus', 10, rollRestTask, x => `${x.n}/${x.d}`);
    setTask(t);
    setVals(['', '']); setDone([false, false]); setWrong([false, false]);
    setNote(''); setHelped(false); setHelpReady(false); setRevealed(0);
    setTimeout(() => ref0.current?.focus(), 0);
  };
  useEffect(() => { gen(); }, []);

  const solvedSelf = done[0] && done[1];
  const showing = solvedSelf || helped;

  // Der Hilfe-Knopf kommt erst nach 12 Sekunden — sonst ist er der bequemere Weg,
  // bevor das Kind die Aufgabe ueberhaupt gelesen hat.
  useEffect(() => {
    if (!task || showing) return;
    const id = window.setTimeout(() => setHelpReady(true), 12000);
    return () => clearTimeout(id);
  }, [task, showing]);

  // Rahmen einzeln zeichnen, zuletzt der Rest.
  useEffect(() => {
    if (!showing || !task) return;
    const ids = Array.from({ length: task.q + 1 }, (_, i) =>
      window.setTimeout(() => setRevealed(i + 1), 380 * (i + 1)));
    return () => ids.forEach(clearTimeout);
  }, [showing, task]);

  useAutoFocus(done[0] && !done[1] ? ref1 : ref0, [task, done[0], done[1]]);

  // Sobald das Bild kommt, Tastatur zumachen — auf dem Handy verdeckt sie sonst
  // genau die Kaestchen, um die es geht.
  useEffect(() => { if (showing) (document.activeElement as HTMLElement | null)?.blur(); }, [showing]);

  if (!task) return null;
  const { n, d, q, r } = task;
  const answers = [q, r];
  const complete = revealed > q;              // Bild fertig gezeichnet

  const type = (i: number, val: string) => {
    if (done[i] || showing) return;
    setVals(v => v.map((x, k) => (k === i ? val : x)));

    const num = parseInt(val); if (isNaN(num)) return;

    if (num === answers[i]) {
      playSound('correct'); setNote('');
      const nd = done.map((x, k) => (k === i ? true : x));
      setDone(nd);
      if (!nd[1 - i]) setTimeout(() => refs[1 - i].current?.focus(), 0);
    } else if (val.length >= answers[i].toString().length) {
      // Der haeufigste Fehler beim Teilen mit Rest ist ein Rest, der noch einmal
      // durch den Teiler passt — den nennen wir beim Namen statt nur "falsch".
      playSound('wrong');
      setNote(i === 1 && num >= d ? `Der Rest muss kleiner als ${d} sein!` : '');
      setHelpReady(true);
      setWrong(w => w.map((x, k) => (k === i ? true : x)));
      setTimeout(() => {
        setVals(v => v.map((x, k) => (k === i ? '' : x)));
        setWrong(w => w.map((x, k) => (k === i ? false : x)));
        refs[i].current?.focus();
      }, 450);
    }
  };

  const next = () => {
    // Aufgaben mit Hilfe zaehlen nicht mit — sonst waere der Sticker dreimal
    // Knopfdruck weit.
    if (helped) { gen(); return; }
    setCompleted(c => c + 1);
    if (completed + 1 >= 3) onWin('🍪');
    else gen();
  };

  const field = (i: number) => (
    <input
      ref={refs[i]}
      className={`rh-input ${done[i] ? 'done' : wrong[i] ? 'wrong' : ''} ${helped ? 'helped' : ''}`}
      type="number"
      value={helped ? String(answers[i]) : vals[i]}
      readOnly={done[i] || showing}
      onChange={e => type(i, e.target.value)}
    />
  );

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #0097a728 0%, #f3fdff 100%)' }}>
      <GameHeader category="division-rest" onBack={onBack} />
      <div className="game-container rh-container" style={{ '--house-color': '#0097a7' } as any}>
        <StarProgress solved={completed} total={3} />

        <div className={`rh-task ${solvedSelf ? 'solved' : ''} ${helped ? 'helped' : ''}`}>
          <span>{n} : {d} =</span>
          {field(0)}
          <span className="rh-restword">Rest</span>
          {field(1)}
        </div>

        {showing && (
          <div className="rh-boxes">
            {Array.from({ length: q }, (_, g) => (
              <div key={g} className={`rh-group ${revealed > g ? 'framed' : ''}`}>
                {Array.from({ length: d }, (_, i) => <span key={i} className="rh-box" />)}
                <span className="rh-num">{revealed > g ? g + 1 : ''}</span>
              </div>
            ))}
            <div className={`rh-group rest ${complete ? 'framed' : ''}`}>
              {Array.from({ length: r }, (_, i) => <span key={i} className="rh-box rest" />)}
              <span className="rh-num">{complete ? `Rest ${r}` : ''}</span>
            </div>
          </div>
        )}

        {showing && complete && (
          <div className="rh-probe">{q} × {d} = {q * d}, und {r} {r === 1 ? 'bleibt' : 'bleiben'} übrig — {q * d} + {r} = {n}</div>
        )}

        {showing
          ? <button className="rh-next" onClick={next}>Weiter →</button>
          : helpReady && (
            <button className="rh-help" onClick={() => { setHelped(true); setNote(''); }}>
              🔍 Zeig mir das Bild — ohne Stern
            </button>
          )}

        <p className="div-hint">
          {note ? <b className="rh-note">{note}</b>
            : helped ? 'Mit Hilfe gelöst — diese Aufgabe zählt nicht. Die nächste schaffst du allein! 💪'
            : solvedSelf ? `🎉 Zähle die Rahmen: ${q} Stück zu je ${d} — und ${r} ${r === 1 ? 'bleibt' : 'bleiben'} übrig.`
            : `🍪 Wie oft passt ${d} in ${n}? Und was bleibt übrig?`}
        </p>
      </div>
    </div>
  );
};

// ── Punkt vor Strich: erst entscheiden, dann rechnen ──
// Das eigentliche Lernziel ist nicht das Rechnen, sondern die Reihenfolge.
// Deshalb ist der erste Schritt keine Eingabe, sondern ein Antippen: welches
// Rechenzeichen hat Vorfahrt? Wer nur zwei Zahlen ausrechnen muss, kann die
// Regel umgehen, indem er stur von links nach rechts arbeitet — hier nicht.
interface PvsTerm {
  tokens: (number | string)[];  // z.B. [4, '+', 3, '×', 5]
  opIdx: number;                // Index des Punkt-Zeichens: 1 (vorn) oder 3 (hinten)
  v: number;                    // Wert des Punkt-Teils
  result: number;
}

// Mal und Geteilt gemischt — sonst lernt das Kind "das × zuerst" statt der Regel.
// Freies Wuerfeln reicht dafuer nicht: bei 40 % Geteilt besteht jede sechzehnte
// 3er-Runde komplett aus Geteilt-Aufgaben, und das Haus wirkt dann wie ein
// zweites Divisions-Haus. Deshalb folgt auf zwei Geteilt-Aufgaben immer ein Mal.
//
// Die Sperre gilt bewusst nur fuer Geteilt. Eine symmetrische Sperre ("nie mehr
// als zwei gleiche") zieht eine ungleiche Mischung zwangslaeufig Richtung 50:50 —
// gemessen kam Geteilt damit auf 38 %, obwohl nur 15 % gewuerfelt wurden.
// So bleiben es die gewollten rund 32 % bei hoechstens zwei in Folge.
const pvsLastOps: string[] = [];
const pvsPointPart = (): { t: (number | string)[]; v: number } => {
  const op = pvsLastOps[0] === ':' && pvsLastOps[1] === ':'
    ? '×'
    : (Math.random() < 0.35 ? ':' : '×');
  pvsLastOps.unshift(op);
  pvsLastOps.length = 2;

  if (op === ':') {
    const c = randInt(2, 9), q = randInt(2, 9);
    return { t: [c * q, ':', c], v: q };
  }
  const b = randInt(2, 9), c = randInt(2, 9);
  return { t: [b, '×', c], v: b * c };
};

const rollPvs = (): PvsTerm => {
  const { t, v } = pvsPointPart();
  const pointFirst = Math.random() < 0.5;   // steht der Punkt-Teil vorn oder hinten?
  const plus = Math.random() < 0.55;

  if (pointFirst) {
    // v ist mindestens 2, a bleibt kleiner als v — das Ergebnis also positiv.
    const a = plus ? randInt(2, Math.min(30, 100 - v)) : randInt(1, v - 1);
    return { tokens: [...t, plus ? '+' : '−', a], opIdx: 1, v, result: plus ? v + a : v - a };
  }
  const a = plus ? randInt(2, Math.min(30, 100 - v)) : randInt(v + 1, Math.min(99, v + 30));
  return { tokens: [a, plus ? '+' : '−', ...t], opIdx: 3, v, result: plus ? a + v : a - v };
};

const PunktVorStrich = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [task, setTask] = useState<PvsTerm | null>(null);
  const [step, setStep] = useState(0);     // 0 = Zeichen antippen, 1 = Punkt-Teil, 2 = Ergebnis
  const [vals, setVals] = useState(['', '']);
  const [wrong, setWrong] = useState(0);   // 0 = nichts, 1 = Auswahl, 2 = Eingabe
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState(0);
  const advancing = useRef(false);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  const gen = () => {
    setTask(drawFresh('punkt-strich', 10, rollPvs, t => t.tokens.join('')));
    setStep(0); setVals(['', '']); setWrong(0); setNote('');
    advancing.current = false;
  };
  useEffect(() => { gen(); }, []);
  // Schritt 0 ist ein Antippen, da gibt es kein Feld — die Ref ist dann leer.
  useAutoFocus(step === 2 ? ref2 : ref1, [task, step]);
  if (!task) return null;

  const { tokens, opIdx, v, result } = task;
  const pointFirst = opIdx === 1;
  const strichOp = tokens[pointFirst ? 3 : 1] as string;
  const a = tokens[pointFirst ? 4 : 0] as number;

  const pickOp = (i: number) => {
    if (step !== 0) return;
    if (i === opIdx) {
      playSound('correct'); setNote('');
      setStep(1);
      setTimeout(() => ref1.current?.focus(), 0);
    } else {
      playSound('wrong');
      setNote('🚦 Punkt vor Strich — Mal und Geteilt haben Vorfahrt!');
      setWrong(1);
      setTimeout(() => setWrong(0), 450);
    }
  };

  const type = (i: number, val: string) => {
    if (advancing.current) return;
    setVals(p => p.map((x, k) => (k === i ? val : x)));
    const num = parseInt(val); if (isNaN(num)) return;
    const expected = i === 0 ? v : result;

    if (num === expected) {
      playSound('correct'); setNote('');
      if (i === 0) {
        setStep(2);
        setTimeout(() => ref2.current?.focus(), 0);
      } else {
        advancing.current = true;
        setTimeout(() => {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('🚦');
          else gen();
        }, 1300);                                  // Zeit, die fertige Zeile zu sehen
      }
    } else if (val.length >= expected.toString().length) {
      playSound('wrong');
      setWrong(2);
      setTimeout(() => {
        setVals(p => p.map((x, k) => (k === i ? '' : x)));
        setWrong(0);
        (i === 0 ? ref1 : ref2).current?.focus();
      }, 450);
    }
  };

  // Der Punkt-Teil bleibt als Block zusammen — nach der Auswahl wird er
  // eingerahmt, damit sichtbar ist, welches Stueck gerade dran ist.
  const partBlock = (
    <span className={`pvs-part ${step > 0 ? 'chosen' : ''}`}>
      {tokens[opIdx - 1]}
      {step === 0
        ? <button className="pvs-op" onClick={() => pickOp(opIdx)}>{tokens[opIdx]}</button>
        : <span className="pvs-op-flat">{tokens[opIdx]}</span>}
      {tokens[opIdx + 1]}
    </span>
  );
  const strichBlock = step === 0
    ? <button className="pvs-op" onClick={() => pickOp(pointFirst ? 3 : 1)}>{strichOp}</button>
    : <span className="pvs-op-flat">{strichOp}</span>;

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #3949ab28 0%, #f6f7ff 100%)' }}>
      <GameHeader category="punkt-vor-strich" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#3949ab' } as any}>
        <StarProgress solved={completed} total={3} />

        <div className={`pvs-term ${wrong === 1 ? 'shake' : ''}`}>
          {pointFirst
            ? <>{partBlock}{strichBlock}<span>{a}</span></>
            : <><span>{a}</span>{strichBlock}{partBlock}</>}
        </div>

        {step === 0 && <div className="pvs-ask">Welches Rechenzeichen ist zuerst dran?</div>}

        {step >= 1 && (
          <div className="pvs-rows">
            <div className={`pvs-row ${step > 1 ? 'done' : wrong === 2 ? 'wrong' : 'active'}`}>
              <span className="pvs-calc">{tokens[opIdx - 1]} {tokens[opIdx]} {tokens[opIdx + 1]} =</span>
              <input ref={ref1} className="pvs-input" type="number"
                value={step > 1 ? String(v) : vals[0]} readOnly={step > 1}
                onChange={e => type(0, e.target.value)} />
              {step > 1 && <span className="pvs-check">✓</span>}
            </div>

            {step >= 2 && (
              <div className={`pvs-row ${vals[1] && parseInt(vals[1]) === result ? 'done' : wrong === 2 ? 'wrong' : 'active'}`}>
                <span className="pvs-calc">
                  {pointFirst ? <><b>{v}</b> {strichOp} {a} =</> : <>{a} {strichOp} <b>{v}</b> =</>}
                </span>
                <input ref={ref2} className="pvs-input" type="number" value={vals[1]}
                  onChange={e => type(1, e.target.value)} />
              </div>
            )}
          </div>
        )}

        <p className="div-hint">
          {note ? <b className="pvs-note">{note}</b>
            : step === 0 ? '🚦 Tippe das Zeichen an, das Vorfahrt hat'
            : step === 1 ? 'Rechne zuerst den Punkt-Teil aus'
            : 'Und jetzt der Rest — fast geschafft!'}
        </p>
      </div>
    </div>
  );
};

// ── Uhren-Turm: Ablesen, Einstellen, Zeitspannen ──
// Drei Aufgabentypen im Wechsel, weil der Zettel alle drei verlangt. Die Uhr ist
// gezeichnet und nicht digital: das Ablesen der Zeiger IST der Lernstoff.

const ClockFace = ({ h, m, size = 150 }: { h: number; m: number; size?: number }) => {
  // Der Stundenzeiger wandert mit den Minuten mit — eine Uhr, die um 3:30 noch
  // exakt auf der 3 steht, gibt es nicht, und genau diese Zwischenstellung ist
  // der Grund, warum "halb 4" schwerfaellt.
  const ha = ((h % 12) + m / 60) * 30;
  const ma = m * 6;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="clock">
      <circle cx="50" cy="50" r="47" className="clock-rim" />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="50" y1="7" x2="50" y2={i % 5 === 0 ? '13' : '10'}
          className={`clock-tick ${i % 5 === 0 ? 'big' : ''}`}
          transform={`rotate(${i * 6} 50 50)`} />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) * 30 - 90) * Math.PI / 180;
        return (
          <text key={i} className="clock-num"
            x={50 + Math.cos(a) * 33} y={50 + Math.sin(a) * 33}>{i + 1}</text>
        );
      })}
      <line x1="50" y1="50" x2="50" y2="28" className="clock-hand hour"
        transform={`rotate(${ha} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="15" className="clock-hand minute"
        transform={`rotate(${ma} 50 50)`} />
      <circle cx="50" cy="50" r="3.4" className="clock-pin" />
    </svg>
  );
};

const two = (n: number) => (n < 10 ? `0${n}` : String(n));

// Sprechweise wie im Unterricht. "halb 4" meint 3:30 — die haeufigste
// Stolperstelle ueberhaupt, deshalb kommt sie oft dran.
const timeWord = (h: number, m: number) => {
  const next = h === 12 ? 1 : h + 1;
  if (m === 0)  return `${h} Uhr`;
  if (m === 15) return `Viertel nach ${h}`;
  if (m === 30) return `halb ${next}`;
  if (m === 45) return `Viertel vor ${next}`;
  return `${m} Minuten nach ${h}`;
};

type ClockTask =
  | { kind: 'read'; h: number; m: number }
  | { kind: 'set'; h: number; m: number; options: { h: number; m: number }[] }
  | { kind: 'span'; h1: number; m1: number; h2: number; m2: number; mins: number };

// Volle und halbe Stunden haben Uebergewicht — sie stehen so auf dem Zettel.
const READ_MINUTES = [0, 0, 0, 30, 30, 30, 15, 15, 45, 45, 5, 10, 20, 25, 35, 40, 50, 55];

const rollClockTask = (kind: ClockTask['kind']): ClockTask => {
  if (kind === 'read') {
    return { kind, h: randInt(1, 12), m: pick(READ_MINUTES) };
  }
  if (kind === 'set') {
    const h = randInt(1, 12);
    const m = pick([0, 15, 30, 45]);
    const next = h === 12 ? 1 : h + 1;
    // Die Ablenker sind genau die typischen Verwechslungen: eine Stunde weiter
    // (aus "halb 4" wird 4:30) und die anderen Viertel derselben Stunde.
    const pool = [
      { h, m: 0 }, { h, m: 15 }, { h, m: 30 }, { h, m: 45 },
      { h: next, m: 0 }, { h: next, m: 30 }, { h: next, m: 15 }, { h: next, m: 45 },
    ].filter(o => !(o.h === h && o.m === m));
    return { kind, h, m, options: shuffle([{ h, m }, ...shuffle(pool).slice(0, 3)]) };
  }
  // Zeitspanne: hoechstens 55 Minuten, dafuer meistens ueber den Stundenwechsel —
  // genau daran scheitert das Rechnen mit Uhrzeiten.
  const h1 = randInt(1, 12);
  const m1 = randInt(0, 11) * 5;
  const mins = randInt(1, 11) * 5;
  const total = m1 + mins;
  const h2 = total >= 60 ? (h1 === 12 ? 1 : h1 + 1) : h1;
  return { kind: 'span', h1, m1, h2, m2: total % 60, mins };
};

const UhrenTurm = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  // Fester Plan statt freiem Wuerfeln: so kommt jeder der drei Typen in einer
  // Runde sicher vor und nicht viermal dasselbe.
  const plan = useRef<ClockTask['kind'][]>(
    shuffle(['read', 'set', 'span', pick(['read', 'set', 'span'] as const)]));
  const [task, setTask] = useState<ClockTask | null>(null);
  const [vals, setVals] = useState(['', '']);
  const [done, setDone] = useState([false, false]);
  const [wrong, setWrong] = useState(-1);      // Index des falschen Feldes / der Uhr
  const [solved, setSolved] = useState(0);
  const advancing = useRef(false);
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1];

  // Uhrzeiten lassen sich nicht wie die anderen Haeuser an der Eingabelaenge
  // pruefen: bei "12 Uhr" waere die getippte 1 sofort ein Fehler, und bei
  // "5 nach" waere die fuehrende 0 von "05" einer. Deshalb zaehlt hier eine
  // Pause: richtig wird sofort erkannt, falsch erst, wenn das Kind aufhoert
  // zu tippen.
  const missTimer = useRef(0);
  useEffect(() => () => clearTimeout(missTimer.current), []);

  const gen = (idx: number) => {
    clearTimeout(missTimer.current);
    setTask(rollClockTask(plan.current[idx] ?? pick(['read', 'set', 'span'] as const)));
    setVals(['', '']); setDone([false, false]); setWrong(-1);
    advancing.current = false;
    setTimeout(() => ref0.current?.focus(), 0);
  };
  useEffect(() => { gen(0); }, []);
  useAutoFocus(done[0] && !done[1] ? ref1 : ref0, [task, done[0], done[1]]);
  if (!task) return null;

  const finish = () => {
    advancing.current = true;
    setTimeout(() => {
      const n = solved + 1;
      setSolved(n);
      if (n >= 4) onWin('⏰');
      else gen(n);
    }, 1100);
  };

  const miss = (i: number, reset: () => void) => {
    playSound('wrong');
    setWrong(i);
    setTimeout(() => { setWrong(-1); reset(); }, 500);
  };

  const clearMiss = () => { clearTimeout(missTimer.current); missTimer.current = 0; };
  const scheduleMiss = (i: number, reset: () => void) => {
    clearMiss();
    missTimer.current = window.setTimeout(() => miss(i, reset), 900);
  };

  // ── Typ 1: Uhr ablesen ──
  const readAnswers = task.kind === 'read' ? [task.h, task.m] : [0, 0];
  const typeRead = (i: number, val: string) => {
    if (done[i] || advancing.current) return;
    setVals(v => v.map((x, k) => (k === i ? val : x)));
    const num = parseInt(val); if (isNaN(num)) return;
    if (num === readAnswers[i]) {
      clearMiss();
      playSound('correct');
      const nd = done.map((x, k) => (k === i ? true : x));
      setDone(nd);
      if (nd[0] && nd[1]) finish();
      else setTimeout(() => refs[1 - i].current?.focus(), 0);
    } else {
      scheduleMiss(i, () => {
        setVals(v => v.map((x, k) => (k === i ? '' : x)));
        refs[i].current?.focus();
      });
    }
  };

  // ── Typ 3: Zeitspanne ──
  const typeSpan = (val: string) => {
    if (advancing.current || task.kind !== 'span') return;
    setVals(v => [val, v[1]]);
    const num = parseInt(val); if (isNaN(num)) return;
    if (num === task.mins) { clearMiss(); playSound('correct'); setDone([true, true]); finish(); }
    else scheduleMiss(0, () => { setVals(['', '']); ref0.current?.focus(); });
  };

  // ── Typ 2: richtige Uhr antippen ──
  const chooseClock = (i: number) => {
    if (advancing.current || task.kind !== 'set') return;
    const o = task.options[i];
    if (o.h === task.h && o.m === task.m) { playSound('correct'); setDone([true, true]); finish(); }
    else miss(i, () => {});
  };

  const solvedAll = done[0] && done[1];

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #6d4c4128 0%, #fffaf5 100%)' }}>
      <GameHeader category="uhrzeit" onBack={onBack} />
      <div className="game-container uhr-container" style={{ '--house-color': '#6d4c41' } as any}>
        <StarProgress solved={solved} total={4} />

        {task.kind === 'read' && (
          <>
            <ClockFace h={task.h} m={task.m} size={190} />
            <div className={`uhr-answer ${solvedAll ? 'solved' : ''}`}>
              <input ref={ref0} className={`uhr-input ${done[0] ? 'done' : wrong === 0 ? 'wrong' : ''}`}
                type="number" value={vals[0]} readOnly={done[0]}
                onChange={e => typeRead(0, e.target.value)} />
              <span className="uhr-colon">:</span>
              <input ref={ref1} className={`uhr-input ${done[1] ? 'done' : wrong === 1 ? 'wrong' : ''}`}
                type="number" value={done[1] ? two(task.m) : vals[1]} readOnly={done[1]}
                onChange={e => typeRead(1, e.target.value)} />
              <span className="uhr-unit">Uhr</span>
            </div>
            {solvedAll && <div className="uhr-word">{timeWord(task.h, task.m)}</div>}
          </>
        )}

        {task.kind === 'set' && (
          <>
            <div className="uhr-prompt">Welche Uhr zeigt <b>{timeWord(task.h, task.m)}</b>?</div>
            <div className="uhr-choices">
              {task.options.map((o, i) => {
                const right = o.h === task.h && o.m === task.m;
                return (
                  <button key={i}
                    className={`uhr-choice ${wrong === i ? 'wrong' : ''} ${solvedAll && right ? 'right' : ''}`}
                    onClick={() => chooseClock(i)}>
                    <ClockFace h={o.h} m={o.m} size={112} />
                    {solvedAll && right && <span className="uhr-choice-label">{o.h}:{two(o.m)}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {task.kind === 'span' && (
          <>
            <div className="uhr-span">
              <div className="uhr-span-one">
                <ClockFace h={task.h1} m={task.m1} size={118} />
                <span className="uhr-span-time">{task.h1}:{two(task.m1)}</span>
                <span className="uhr-span-tag">Start</span>
              </div>
              <div className="uhr-span-arrow">→</div>
              <div className="uhr-span-one">
                <ClockFace h={task.h2} m={task.m2} size={118} />
                <span className="uhr-span-time">{task.h2}:{two(task.m2)}</span>
                <span className="uhr-span-tag">Ende</span>
              </div>
            </div>
            <div className={`uhr-answer ${solvedAll ? 'solved' : ''}`}>
              <input ref={ref0} className={`uhr-input wide ${done[0] ? 'done' : wrong === 0 ? 'wrong' : ''}`}
                type="number" value={vals[0]} readOnly={done[0]}
                onChange={e => typeSpan(e.target.value)} />
              <span className="uhr-unit">Minuten</span>
            </div>
          </>
        )}

        <p className="div-hint">
          {task.kind === 'read'
            ? (solvedAll ? '🎉 Genau — kurzer Zeiger die Stunde, langer die Minuten.'
              : '⏰ Wie spät ist es? Erst die Stunde, dann die Minuten.')
            : task.kind === 'set'
              ? (solvedAll ? '🎉 Richtig erkannt!' : '⏰ Achtung: der kurze Zeiger steht oft schon zwischen zwei Zahlen.')
              : (solvedAll ? '🎉 Geschafft!' : '⏰ Wie viele Minuten liegen zwischen Start und Ende?')}
        </p>
      </div>
    </div>
  );
};

const MathGame = ({ category, performance, onAttempt, onWin, onBack }: { category: Category; performance: PerformanceData; onAttempt: (k: string, c: boolean) => void; onWin: (s: string) => void; onBack: () => void }) => {
  const [problem, setProblem] = useState(generateProblem(category, performance));
  const [input, setInput] = useState('');
  const [solved, setSolved] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, [problem]);
  const total = (category === 'sachaufgaben' || category === 'platzhalter') ? 3 : 5;
  const building = BUILDINGS.find(b => b.category === category)!;
  const check = (val: string) => {
    const n = parseInt(val); if (isNaN(n)) return;
    if (n === problem.answer) {
      playSound('correct'); onAttempt(problem.key, true);
      setTimeout(() => {
        setSolved(c => c + 1);
        if (solved + 1 >= total) onWin(STICKERS[Math.floor(Math.random() * STICKERS.length)]);
        else { setProblem(generateProblem(category, performance)); setInput(''); }
      }, 600);
    } else if (val.length >= problem.answer.toString().length) { playSound('wrong'); onAttempt(problem.key, false); setInput(''); }
  };
  return (
    <div className="game-page" style={{ background: `linear-gradient(160deg, ${building.color}28 0%, #f5f8ff 100%)` }}>
      <GameHeader category={category} onBack={onBack} />
      <div className="game-container" style={{ '--house-color': building.color, maxWidth: problem.type === 'story' ? '800px' : '600px' } as any}>
        <StarProgress solved={solved} total={total} />
        {problem.type === 'story'
          ? <div className="story-box">{(problem.question as string[]).map((l: string, i: number) => <p key={i}>{l}</p>)}</div>
          : problem.type === 'division-denn'
            ? <div className="division-denn">
                <div className="div-question">{problem.question}</div>
                <div className="div-denn">denn&nbsp;&nbsp;{problem.denn}</div>
              </div>
            : <div className="task">{problem.question}{problem.type !== 'placeholder' && ' = ?'}</div>
        }
        <input ref={inputRef} autoFocus className="input-field" type="number" value={input} onChange={e => { setInput(e.target.value); check(e.target.value); }} />
      </div>
    </div>
  );
};

// ============================================================
// APP
// ============================================================
export default function App() {
  const [state, setState] = useState<{
    category: Category | null;
    stickers: Record<Category, string[]>;
    performance: PerformanceData;
    multiplicationGrid: Record<string, boolean>;
  }>(() => {
    const saved = localStorage.getItem('mathemagic-save');
    const defaults = { category: null, stickers: DEFAULT_STICKERS, performance: {}, multiplicationGrid: {} };
    if (!saved) return defaults;
    try { const p = JSON.parse(saved); return { ...defaults, ...p, stickers: { ...DEFAULT_STICKERS, ...(p.stickers || {}) } }; }
    catch { return defaults; }
  });

  const [pendingWin, setPendingWin] = useState<{ sticker: string; category: Category } | null>(null);
  const panRef = useRef<HTMLDivElement>(null);

  // Auf schmalen Geräten ist die Karte breiter als der Bildschirm — dann in der
  // Mitte starten statt am linken Rand, sonst sieht man nur Wald.
  useEffect(() => {
    const el = panRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [state.category]);

  const totalStickers = Object.values(state.stickers).flat().length;
  const currentTier = [...ANIMAL_TIERS].reverse().find(t => totalStickers >= t.threshold);

  useEffect(() => {
    const { category, ...toSave } = state;
    localStorage.setItem('mathemagic-save', JSON.stringify(toSave));
  }, [state]);

  const setCategory = (cat: Category | null) => setState(p => ({ ...p, category: cat }));
  const onBack = () => setCategory(null);
  const onAttempt = (key: string, correct: boolean) => setState(p => ({ ...p, performance: { ...p.performance, [key]: Math.max(1, (p.performance[key] || 10) + (correct ? -2 : 10)) } }));
  const onWin = (sticker: string) => {
    if (!state.category) return;
    setPendingWin({ sticker, category: state.category });
  };
  const saveWin = () => {
    if (!pendingWin) return;
    setState(p => ({ ...p, category: null, stickers: { ...p.stickers, [pendingWin.category]: [...(p.stickers[pendingWin.category] || []), pendingWin.sticker] } }));
    setPendingWin(null);
  };
  const onMarkCell = (key: string) => setState(p => ({ ...p, multiplicationGrid: { ...p.multiplicationGrid, [key]: true } }));
  const reset = () => { if (window.confirm('Spielstand wirklich zurücksetzen?')) { setState({ category: null, stickers: DEFAULT_STICKERS, performance: {}, multiplicationGrid: {} }); localStorage.removeItem('mathemagic-save'); } };

  // ── Win screen ──
  if (pendingWin) {
    const b = BUILDINGS.find(b => b.category === pendingWin.category)!;
    return (
      <div className="win-screen" style={{ background: `linear-gradient(135deg, ${b.color}66 0%, ${b.roofColor}44 100%)` }}>
        <div className="win-card">
          <div className="win-sticker">{pendingWin.sticker}</div>
          <h2 className="win-title">Super gemacht! 🎉</h2>
          <p className="win-subtitle">{b.icon} {b.label}</p>
          <button className="win-btn" onClick={saveWin}>Zur Karte →</button>
        </div>
      </div>
    );
  }

  // ── Game routing ──
  if (state.category === 'division')          return <DivisionGame onWin={onWin} onBack={onBack} />;
  if (state.category === 'division-zerlegen') return <ZerlegeDivision onWin={onWin} onBack={onBack} />;
  if (state.category === 'division-rest')     return <RestHaus onWin={onWin} onBack={onBack} />;
  if (state.category === 'punkt-vor-strich')  return <PunktVorStrich onWin={onWin} onBack={onBack} />;
  if (state.category === 'uhrzeit')           return <UhrenTurm onWin={onWin} onBack={onBack} />;
  if (state.category === 'zahlen-fabrik')    return <FactoryGame onWin={onWin} onBack={onBack} />;
  if (state.category === 'meister-zelt')     return <ComparisonGame onWin={onWin} onBack={onBack} />;
  if (state.category === 'zahlen-mauer')     return <NumberWall onWin={onWin} onBack={onBack} />;
  if (state.category === 'differenz-jagd')   return <DifferenceHunt onWin={onWin} onBack={onBack} />;
  if (state.category === 'einmaleins-tafel') return <MultiplicationTafel grid={state.multiplicationGrid} onWin={onWin} onBack={onBack} onMarkCell={onMarkCell} />;
  if (state.category === 'tausch-arena')     return <TauschArena onWin={onWin} onBack={onBack} />;
  if (state.category)                        return <MathGame category={state.category} performance={state.performance} onAttempt={onAttempt} onWin={onWin} onBack={onBack} />;

  // ── MAP SCREEN ──
  return (
    <div className="map-screen">
      {/* floating clouds */}
      <div className="cloud map-cloud" style={{ top: '4%',  width: '140px', height: '55px', animationDelay: '0s'   }} />
      <div className="cloud map-cloud" style={{ top: '10%', width: '95px',  height: '38px', animationDelay: '-7s'  }} />
      <div className="cloud map-cloud" style={{ top: '6%',  width: '110px', height: '44px', animationDelay: '-14s' }} />

      {/* header */}
      <div className="map-header">
        <div>
          <h1 className="village-title map-title" style={{ margin: 0 }}>
            Julia's Mathe-Dorf 🏘️
          </h1>
          <div className="map-subtitle">🐼 für die Panda-Klasse 3b</div>
        </div>
        <div className="map-score-pill">
          {currentTier?.emoji ?? '🐼'}&nbsp;
          <Star size={14} fill="#f59e0b" stroke="none" style={{ verticalAlign: 'middle' }} />
          &nbsp;{totalStickers} Sticker
        </div>
      </div>

      {/* map — auf schmalen Geräten horizontal wischbar */}
      <div className="map-pan" ref={panRef}>
      <div className="map-viewport">
        <MapTerrain />

        {/* buildings */}
        {BUILDINGS.map(b => (
          <MapBuilding
            key={b.category}
            label={b.label}
            icon={b.icon}
            color={b.color}
            roofColor={b.roofColor}
            shape={b.shape}
            stickers={state.stickers[b.category] || []}
            left={b.left}
            top={b.top}
            onClick={() => setCategory(b.category)}
          />
        ))}

        {/* animal residents — unlock one per tier reached */}
        {ANIMAL_SPOTS.map(spot => {
          const unlocked = totalStickers >= spot.threshold;
          const isCurrent = currentTier?.emoji === spot.emoji;
          return (
            <div
              key={spot.emoji}
              className={`map-animal ${unlocked ? (isCurrent ? 'current' : 'unlocked') : 'locked'}`}
              style={{ left: spot.left, top: spot.top }}
              title={unlocked ? spot.emoji : `🔒 ${spot.threshold} Sticker zum Freischalten`}
            >
              {spot.emoji}
            </div>
          );
        })}

        {/* running animal along the main road */}
        <div className="map-runner">
          <span>{currentTier?.emoji ?? '🐼'}</span>
        </div>
      </div>
      </div>

      <div className="map-swipe-hint">← wischen, um das ganze Dorf zu sehen →</div>

      <button className="reset-btn" onClick={reset}><Trash2 size={14} /> Reset</button>
    </div>
  );
}
