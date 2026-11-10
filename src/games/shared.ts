// Gemeinsame Helfer aller Spiele: Zufall, Toene, Sticker.

// --- Zufall ---
// Alle Generatoren ziehen ueber diese Helfer, damit Verteilung und
// Wiederholungs-Schutz an genau einer Stelle liegen.

// Ganzzahl in [min, max] — beide Grenzen eingeschlossen.
export const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

// Fisher-Yates. Das naheliegende `sort(() => Math.random() - 0.5)` ist KEIN
// gueltiger Shuffle: Vergleichsfunktionen muessen konsistent sein, sonst haengt
// das Ergebnis am Sortier-Algorithmus. Gemessen an der Zahlen-Mauer wurde damit
// Stein 1 in 57 % der Runden versteckt, Stein 4 nur in 39 % — die Mauer fragte
// also immer wieder dieselben Positionen ab.
export const shuffle = <T,>(list: readonly T[]): T[] => {
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
export const drawFresh = <T,>(bucket: string, memory: number, roll: () => T, idOf: (t: T) => string): T => {
  const seen = recent[bucket] ?? (recent[bucket] = []);
  let out = roll();
  for (let tries = 0; tries < 60 && seen.includes(idOf(out)); tries++) out = roll();
  seen.push(idOf(out));
  while (seen.length > memory) seen.shift();
  return out;
};

// --- Sound Engine ---
// Ein einziger AudioContext für die ganze App — Browser erlauben nur eine Handvoll
// gleichzeitig, und jeder neue kostet spürbar Zeit beim Anlegen.
let audioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
};

// Ton an/aus — gilt fuer das Geraet und bleibt nach dem Neuladen erhalten.
const SOUND_KEY = 'mathemagic-sound';
let soundOn = (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } })();
export const isSoundOn = () => soundOn;
export const setSoundOn = (on: boolean) => {
  soundOn = on;
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* privater Modus */ }
};

export const playSound = (type: 'correct' | 'wrong') => {
  if (!soundOn) return;
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

export const STICKERS = ['⭐', '🌟', '🦄', '🚀', '🎨', '🍕', '🐱', '🐶', '🌈', '🍦', '🍩', '🦁', '🦉', '💎', '🍭', '⚙️', '🏆', '🎈', '🏰'];
