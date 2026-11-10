// Alle Spiele mit Name, Zeichen und Farbe — Kopfzeile, Siegerbild und
// Siedlungen lesen von hier, damit ein Spiel nur an einer Stelle beschrieben ist.

export type Category =
  | 'plus' | 'minus' | 'verdoppeln-halbieren'
  | 'einmaleins-klein' | 'einmaleins-gross' | 'einmaleins-tafel'
  | 'division' | 'division-zerlegen' | 'division-rest' | 'tausch-arena' | 'kernaufgaben'
  | 'sachaufgaben' | 'platzhalter' | 'punkt-vor-strich' | 'uhrzeit'
  | 'zahlen-fabrik' | 'meister-zelt' | 'differenz-jagd' | 'zahlen-mauer';

// Spiele, die schon auf dem Lernzettel stehen, aber noch gebaut werden. Sie
// erscheinen als Baustelle — so sieht man, was kommt, und der Lernzettel kann
// sie schon verlinken.
export type PlannedGame = 'stellenwert' | 'tausender-streifen' | 'zahlenstrahl' | 'runden' | 'geld' | 'probearbeit';

export type GameId = Category | PlannedGame;

export interface GameInfo {
  label: string;
  icon: string;
  color: string;
  // Ab welcher Klasse das Spiel gedacht ist. Steht als Schild am Haus.
  klasse: 1 | 2 | 3;
  planned?: true;
}

export const GAMES: Record<GameId, GameInfo> = {
  plus:                   { label: 'Plus-Haus',         icon: '➕', color: '#ef5350', klasse: 1 },
  minus:                  { label: 'Minus-Turm',        icon: '➖', color: '#42a5f5', klasse: 1 },
  'verdoppeln-halbieren': { label: 'Spiegel-Haus',      icon: '🔄', color: '#66bb6a', klasse: 2 },
  'differenz-jagd':       { label: 'Differenz-See',     icon: '🌊', color: '#29b6f6', klasse: 2 },
  'zahlen-mauer':         { label: 'Zahlen-Mauer',      icon: '🧱', color: '#a1887f', klasse: 2 },
  'einmaleins-klein':     { label: '1×1 (bis 5)',       icon: '✖️', color: '#ab47bc', klasse: 2 },
  'einmaleins-gross':     { label: '1×1 (bis 10)',      icon: '✖️', color: '#7b1fa2', klasse: 2 },
  'einmaleins-tafel':     { label: '1×1 Tafel',         icon: '📋', color: '#e91e63', klasse: 2 },
  kernaufgaben:           { label: 'Kern-Trainer',      icon: '🔑', color: '#fb8c00', klasse: 2 },
  'tausch-arena':         { label: 'Tausch-Arena',      icon: '🏡', color: '#43a047', klasse: 2 },
  division:               { label: 'Divisions-Haus',    icon: '➗', color: '#1e88e5', klasse: 2 },
  'division-zerlegen':    { label: 'Zerlege-Werkstatt', icon: '🧩', color: '#00897b', klasse: 3 },
  'division-rest':        { label: 'Rest-Haus',         icon: '🍪', color: '#0097a7', klasse: 3 },
  sachaufgaben:           { label: 'Rechen-Post',       icon: '✉️', color: '#f4511e', klasse: 2 },
  uhrzeit:                { label: 'Uhren-Turm',        icon: '⏰', color: '#6d4c41', klasse: 3 },
  platzhalter:            { label: 'Rätsel-Höhle',      icon: '🔍', color: '#8d6e63', klasse: 2 },
  'punkt-vor-strich':     { label: 'Vorfahrt-Haus',     icon: '🚦', color: '#3949ab', klasse: 3 },
  'zahlen-fabrik':        { label: 'Zahlen-Fabrik',     icon: '⚙️', color: '#546e7a', klasse: 1 },
  'meister-zelt':         { label: 'Meister-Zelt',      icon: '🏆', color: '#f9a825', klasse: 2 },

  stellenwert:            { label: 'Stellenwert-Haus',  icon: '🔢', color: '#5c6bc0', klasse: 3, planned: true },
  'tausender-streifen':   { label: 'Tausender-Streifen', icon: '🧮', color: '#26a69a', klasse: 3, planned: true },
  zahlenstrahl:           { label: 'Zahlenstrahl-Brücke', icon: '📏', color: '#8e24aa', klasse: 3, planned: true },
  runden:                 { label: 'Runden-Turm',       icon: '🎯', color: '#ef6c00', klasse: 3, planned: true },
  geld:                   { label: 'Geld-Laden',        icon: '💶', color: '#2e7d32', klasse: 3, planned: true },
  probearbeit:            { label: 'Probearbeit',       icon: '📝', color: '#c62828', klasse: 3, planned: true },
};

export const isPlayable = (id: GameId): id is Category => !GAMES[id].planned;
