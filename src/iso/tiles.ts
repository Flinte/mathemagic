// Kacheln aus Kenney "Sketch Town" (CC0, siehe assets/sketchtown/License.txt).
// Vite legt jede Datei mit Hash ins Build — geladen wird nur, was eine Szene
// tatsaechlich zeigt.
const FILES = import.meta.glob('../assets/sketchtown/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export type Dir = 'N' | 'E' | 'S' | 'W';

export const tileUrl = (name: string): string => {
  const url = FILES[`../assets/sketchtown/${name}.png`];
  if (!url) throw new Error(`Unbekannte Kachel: ${name}`);
  return url;
};

// ── Geometrie ──
// Jede Kachel ist 256×352 px gross. Die Oberseite eines Wuerfels ist eine Raute,
// deren Mitte bei (ANCHOR_X, ANCHOR_Y) im Bild liegt. Ausgemessen an
// grass_center: Raute 230 px breit, Oberkante y=130, Wuerfelfuss y=346.
export const TILE_W = 256;
export const TILE_H = 352;
export const ANCHOR_X = 128;
export const ANCHOR_Y = 188;
export const HALF_W = 115;   // halbe Rautenbreite = Versatz je Gitterschritt
export const HALF_H = 57.5;  // halbe Rautenhoehe
export const LIFT = 101;     // Hoehe eines Wuerfels = Versatz je Stockwerk

// Gitter → Bildschirm (Mitte der Oberseite). c waechst nach rechts unten,
// r nach links unten, z nach oben.
export const project = (c: number, r: number, z: number) => ({
  x: (c - r) * HALF_W,
  y: (c + r) * HALF_H - z * LIFT,
});

// ── Wege und Fluesse ──
// Kanten der Raute als Bitmaske, Nachbar jeweils in Klammern:
// oben-links (c-1), oben-rechts (r-1), unten-rechts (c+1), unten-links (r+1).
export const UL = 1, UR = 2, LR = 4, LL = 8;

// Welche Weg-Kachel mit welcher Drehung genau die Kanten der Maske verbindet.
// Ausgemessen an den Kenney-Bildern; die Drehung N→E→S→W schiebt jede
// Verbindung eine Kante weiter (LR→LL→UL→UR).
const PATH_PIECES: Record<number, [string, Dir]> = {
  0: ['EndSquare', 'N'],
  [LR]: ['End', 'N'], [LL]: ['End', 'E'], [UL]: ['End', 'S'], [UR]: ['End', 'W'],
  [UL | LR]: ['', 'N'], [UR | LL]: ['', 'E'],
  [LL | LR]: ['Bend', 'N'], [UL | LL]: ['Bend', 'E'], [UL | UR]: ['Bend', 'S'], [UR | LR]: ['Bend', 'W'],
  [UR | LR | LL]: ['Split', 'N'], [UL | LR | LL]: ['Split', 'E'], [UL | UR | LL]: ['Split', 'S'], [UL | UR | LR]: ['Split', 'W'],
  [UL | UR | LR | LL]: ['Crossing', 'N'],
};

export const pathTile = (mask: number): string => {
  const [piece, dir] = PATH_PIECES[mask];
  return `grass_path${piece}_${dir}`;
};
