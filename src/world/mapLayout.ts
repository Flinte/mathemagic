import type { Piece } from '../iso/IsoScene';
import { addGrid, buildCells, cellKey, type Cells, type House } from '../iso/build';
import { ANIMALS } from './islands';
import { HALF_H, HALF_W } from '../iso/tiles';
import { SCHOOL_SCENE, TOWNS, TOWN_GROUND, type TownId } from './towns';

// Die grosse Landkarte: alle Staedte als erhoehte Plateaus auf einer gemeinsamen
// Insel, verbunden durch Wege mit Rampen. Wie die Staedte zueinander stehen,
// haengt vom Bildschirmformat ab — sonst waere die Karte auf dem Handy hochkant
// ein schmaler Streifen mit viel leerem Himmel.

export type LayoutKind = 'tall' | 'square' | 'mid' | 'wide';

// Plaetze in "Stadt-Schritten": i = nach rechts, j = nach unten (auf dem
// Bildschirm). Halbe Schritte versetzen eine Reihe.
const SLOTS: Record<LayoutKind, [TownId, number, number][]> = {
  // Handy hochkant: eine Spalte im Zickzack, Schule oben.
  tall: [['schule', 0, 0], ['tausend', 0.5, 1], ['markt', 0, 2], ['plusminus', 0.5, 3], ['mal', 0, 4], ['teilen', 0.5, 5], ['raetsel', 0, 6]],
  // Tablet hochkant: zwei Spalten.
  square: [['schule', 0.5, 0], ['tausend', 0, 1], ['markt', 1, 1], ['plusminus', 0, 2], ['mal', 1, 2], ['teilen', 0, 3], ['raetsel', 1, 3]],
  // Tablet quer, Computer: drei Reihen, die Schule in der Mitte.
  mid: [['plusminus', 0, 0], ['mal', 1, 0], ['teilen', 2, 0], ['schule', 1, 1], ['tausend', 0, 2], ['markt', 1, 2], ['raetsel', 2, 2]],
  // Handy quer: zwei lange Reihen.
  wide: [['plusminus', 0, 0], ['mal', 1, 0], ['teilen', 2, 0], ['raetsel', 3, 0], ['tausend', 0.5, 1], ['schule', 1.5, 1], ['markt', 2.5, 1]],
};

export const layoutFor = (aspect: number): LayoutKind =>
  aspect < 0.65 ? 'tall' : aspect < 1.2 ? 'square' : aspect < 2.4 ? 'mid' : 'wide';

const STEP = 11;  // Gitterfelder je Stadt-Schritt (Staedte sind bis zu 8 gross)
const PAD = 3;    // Wiese rund um jede Stadt

export interface PlacedTown {
  id: TownId; c: number; r: number; size: number; h: number;
  foot: [number, number];   // Fuss der Rampe — dort steht das Ortsschild
}
export interface MapLayout {
  pieces: Piece[];
  towns: PlacedTown[];
  animals: { emoji: string; threshold: number; c: number; r: number; z: number }[];
}

const sceneOf = (id: TownId) => (id === 'schule' ? SCHOOL_SCENE : TOWNS.find(t => t.id === id)!.scene);
const heightOf = (id: TownId) => TOWNS.find(t => t.id === id)?.height ?? 1;

// Jede Stadt hat ihr Tor in der vordersten Reihe (letzte Zeile des Gitters):
// das erste Wegfeld dort. Die Rampe liegt eine Zeile davor.
const gateOf = (ground: string[]) => {
  const r = ground.length - 1;
  const c = ground[r].indexOf('p');
  if (c < 0) throw new Error('Stadt ohne Weg in der vordersten Reihe');
  return { c, r };
};

// Fester Zufall je Feld — die Karte sieht bei jedem Laden gleich aus.
const noise = (c: number, r: number) => {
  let h = Math.imul(c * 374761393 + r * 668265263, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Weicher Zufall: benachbarte Felder haben aehnliche Werte. Daraus entstehen
// zusammenhaengende Waelder und Huegel statt verstreuter Einzelbaeume.
const smooth = (c: number, r: number, size: number, seed: number) => {
  const gc = Math.floor(c / size), gr = Math.floor(r / size);
  const fc = c / size - gc, fr = r / size - gr;
  const at = (x: number, y: number) => noise(x * 31 + seed * 101, y * 17 + seed * 7);
  const top = at(gc, gr) * (1 - fc) + at(gc + 1, gr) * fc;
  const bottom = at(gc, gr + 1) * (1 - fc) + at(gc + 1, gr + 1) * fc;
  return top * (1 - fr) + bottom * fr;
};

// Auswahl aus einer Liste mit festem Zufallswert n (0 bis 1)
const pick = <T,>(list: readonly T[], n: number): T => list[Math.min(list.length - 1, Math.floor(n * list.length))];

// Kuerzester Weg ueber freie Wiese, Abbiegen kostet extra — sonst entstehen
// Treppen-Wege mit einer Kurve auf jedem Feld.
const route = (free: (c: number, r: number) => boolean, from: [number, number], to: [number, number]) => {
  const D: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const best = new Map<string, number>();
  const prev = new Map<string, string>();
  const open: { k: string; c: number; r: number; d: number; cost: number }[] = [{ k: `${from}|-1`, c: from[0], r: from[1], d: -1, cost: 0 }];
  best.set(`${from}|-1`, 0);
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift()!;
    if (cur.c === to[0] && cur.r === to[1]) {
      const cells: [number, number][] = [];
      for (let k: string | undefined = cur.k; k; k = prev.get(k)) {
        const [pos] = k.split('|');
        const [c, r] = pos.split(',').map(Number);
        cells.push([c, r]);
      }
      return cells;
    }
    D.forEach(([dc, dr], d) => {
      const c = cur.c + dc, r = cur.r + dr;
      if (!free(c, r) && !(c === to[0] && r === to[1])) return;
      const cost = cur.cost + 1 + (cur.d >= 0 && cur.d !== d ? 3 : 0);
      const k = `${c},${r}|${d}`;
      if (cost >= (best.get(k) ?? Infinity)) return;
      best.set(k, cost); prev.set(k, cur.k);
      open.push({ k, c, r, d, cost });
    });
  }
  return [];
};

const build = (kind: LayoutKind, aspect: number): MapLayout => {
  // 1. Staedte platzieren
  const towns: PlacedTown[] = SLOTS[kind].map(([id, i, j]) => {
    const size = sceneOf(id).ground.length;
    const off = Math.floor((8 - size) / 2);   // kleinere Staedte mittig im Platz
    return { id, c: Math.round((i + j) * STEP) + off, r: Math.round((j - i) * STEP) + off, size, h: heightOf(id), foot: [0, 0] };
  });
  const minC = Math.min(...towns.map(t => t.c)) - PAD;
  const minR = Math.min(...towns.map(t => t.r)) - PAD;
  for (const t of towns) { t.c -= minC; t.r -= minR; }

  const inTown = (c: number, r: number) => towns.some(t => c >= t.c && c < t.c + t.size && r >= t.r && r < t.r + t.size);
  // Abstand (in Feldern) zur naechsten Stadt
  const townDist = (c: number, r: number) => Math.min(...towns.map(t =>
    Math.max(t.c - c, c - (t.c + t.size - 1), t.r - r, r - (t.r + t.size - 1), 0)));

  // 2. Land: ein auf dem Bildschirm rechteckiges Stueck Wiese um alle Staedte.
  // Auf dem Bildschirm ist x ~ c − r und y ~ c + r; begrenzt wird also in
  // diesen beiden Richtungen, nicht in c und r.
  const corners = towns.flatMap(t => [[t.c, t.r], [t.c + t.size - 1, t.r], [t.c, t.r + t.size - 1], [t.c + t.size - 1, t.r + t.size - 1]]);
  let u0 = Math.min(...corners.map(([c, r]) => c - r)) - PAD, u1 = Math.max(...corners.map(([c, r]) => c - r)) + PAD;
  let v0 = Math.min(...corners.map(([c, r]) => c + r)) - PAD, v1 = Math.max(...corners.map(([c, r]) => c + r)) + PAD;
  // Das Land waechst links/rechts oder oben/unten, bis es das Seitenverhaeltnis
  // des Bildschirms hat — sonst bliebe neben der Karte leerer Himmel.
  const widthPx = () => (u1 - u0) * HALF_W + 2 * HALF_W;
  const heightPx = () => (v1 - v0) * HALF_H + 2 * HALF_H + 2 * 101;
  if (widthPx() / heightPx() < aspect) {
    const extra = Math.ceil((aspect * heightPx() - widthPx()) / HALF_W / 2);
    u0 -= extra; u1 += extra;
  } else {
    const extra = Math.ceil((widthPx() / aspect - heightPx()) / HALF_H / 2);
    v0 -= extra; v1 += extra;
  }
  const cells: Cells = new Map();
  for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) {
    if ((u + v) % 2 !== 0) continue;   // c und r muessen ganzzahlig sein
    cells.set(cellKey((u + v) / 2, (v - u) / 2), { ch: 'g', h: 0 });
  }

  // Seen dort, wo weit und breit keine Stadt ist — Teich-Mittelpunkte aus dem
  // festen Zufall, je ein kleines Rund drumherum.
  // Am Kartenrand keine Seen — dort sahen die Wasserwuerfel aus wie Glas.
  const inner = (c: number, r: number) => c - r > u0 + 2 && c - r < u1 - 2 && c + r > v0 + 2 && c + r < v1 - 3;
  for (const k of cells.keys()) {
    const [c, r] = k.split(',').map(Number);
    if (noise(c * 3 + 1, r * 7 + 2) > 0.018 || townDist(c, r) < 5 || !inner(c, r)) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -2; dc <= 1; dc++) {
      const n = cells.get(cellKey(c + dc, r + dr));
      if (n && townDist(c + dc, r + dr) >= 3 && inner(c + dc, r + dr) && Math.abs(dc + 0.5) + Math.abs(dr) < 2.6) n.ch = 'o';
    }
  }

  // 3. Staedte als Plateau (meist eine Stufe hoch), Rampen vor dem Tor —
  // je Stufe eine, der Rätsel-Berg hat also eine Treppe aus zwei Rampen.
  const houses: House[] = [];
  const feet: [number, number][] = [];
  for (const t of towns) {
    const scene = sceneOf(t.id);
    addGrid(cells, scene.ground, t.h, t.c, t.r, TOWN_GROUND);
    for (const h of scene.houses ?? []) houses.push({ ...h, c: h.c + t.c, r: h.r + t.r });
    const g = gateOf(scene.ground);
    for (let k = 0; k < t.h; k++) cells.set(cellKey(t.c + g.c, t.r + g.r + 1 + k), { ch: 'p', h: t.h - 1 - k, ramp: 'E' });
    t.foot = [t.c + g.c, t.r + g.r + 1 + t.h];
    feet.push(t.foot);
  }

  // 3b. Landschaft zwischen den Staedten: Huegel, Felder, kleine Weiler.
  // Alles mit Abstand zu den Staedten, damit Rampen und Wege Platz haben.
  const flatMeadow = (c: number, r: number) => {
    const cell = cells.get(cellKey(c, r));
    return !!cell && cell.h === 0 && cell.ch === 'g' && inner(c, r) && townDist(c, r) >= 3;
  };
  // Huegel: zusammenhaengende Flaechen eine Stufe hoch
  for (const [k, cell] of cells) {
    const [c, r] = k.split(',').map(Number);
    if (cell.ch === 'g' && cell.h === 0 && townDist(c, r) >= 4 && inner(c, r) && smooth(c, r, 7, 11) > 0.7) cell.h = 1;
  }
  // Felder: Rechtecke mit Furchen — gruen bepflanzt, Weizen oder frisch gepfluegt
  for (const k of [...cells.keys()]) {
    const [c, r] = k.split(',').map(Number);
    if (noise(c * 5 + 3, r * 11 + 7) > 0.012 || !flatMeadow(c, r)) continue;
    const kind = pick(['f', 'w', 'F'], noise(c, r * 3));
    const w = 3 + Math.floor(noise(c + 9, r) * 2), d = 2 + Math.floor(noise(c, r + 9) * 3);
    for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) {
      if (flatMeadow(c + dc, r + dr)) cells.get(cellKey(c + dc, r + dr))!.ch = kind;
    }
  }
  // Weiler: zwei, drei Haeuschen mit bunten Daechern
  const hamlet: [number, number][] = [];
  for (const k of [...cells.keys()]) {
    const [c, r] = k.split(',').map(Number);
    if (noise(c * 7 + 1, r * 13 + 5) > 0.006 || townDist(c, r) < 4) continue;
    for (const [dc, dr] of [[0, 0], [2, 0], [0, 2]].slice(0, 2 + Math.floor(noise(c, r + 5) * 2))) {
      if (!flatMeadow(c + dc, r + dr)) continue;
      cells.get(cellKey(c + dc, r + dr))!.ch = 'H';
      hamlet.push([c + dc, r + dr]);
    }
  }

  // 4. Wege: jede Stadt an die naechste schon verbundene (wie ein Spannbaum).
  // Gegangen wird ueber Wiese; nur wenn es gar nicht anders geht, auch ueber
  // ein Feld (nie durch Haeuser, Wasser oder Huegel).
  const isRamp = (c: number, r: number) => !!cells.get(cellKey(c, r))?.ramp;
  const passable = (c: number, r: number, overFields: boolean) => {
    const cell = cells.get(cellKey(c, r));
    return !!cell && cell.h === 0 && !cell.ramp && !inTown(c, r)
      && (cell.ch === 'g' || cell.ch === 'p' || (overFields && 'fwF'.includes(cell.ch)))
      // nicht seitlich an einer Rampe vorbei — sonst haengt der Weg an der Rampe fest
      && !isRamp(c - 1, r) && !isRamp(c + 1, r);
  };
  for (const f of feet) cells.set(cellKey(...f), { ch: 'p', h: 0 });
  const linked = [0];
  while (linked.length < feet.length) {
    let bestPair: [number, number] = [0, 0], bestD = Infinity;
    for (const a of linked) feet.forEach((f, b) => {
      if (linked.includes(b)) return;
      const d = Math.abs(f[0] - feet[a][0]) + Math.abs(f[1] - feet[a][1]);
      if (d < bestD) { bestD = d; bestPair = [a, b]; }
    });
    const [a, b] = bestPair;
    let way = route((c, r) => passable(c, r, false), feet[b], feet[a]);
    if (way.length === 0) way = route((c, r) => passable(c, r, true), feet[b], feet[a]);
    for (const [c, r] of way) cells.set(cellKey(c, r), { ch: 'p', h: 0 });
    linked.push(b);
  }

  // Haeuser der Weiler (nur wo noch Bauplatz ist)
  const ROOFS = ['roof_gableBrown', 'roof_gableGreen', 'roof_gablePurple', 'roof_gableBeige', 'roof_slantBrown', 'roof_roundedGreen'];
  for (const [c, r] of hamlet) {
    if (cells.get(cellKey(c, r))?.ch !== 'H') continue;
    const n = noise(c * 3, r * 5);
    houses.push({ c, r, floors: [n < 0.5 ? 'building_doorWindows' : 'building_doorWindowsBeige'], roof: pick(ROOFS, noise(r, c)), dir: n < 0.25 || n > 0.75 ? 'N' : 'E' });
  }

  // 5. Baeume: Waelder dicht beieinander, sonst nur hier und da ein Baum,
  // ein Busch oder ein Felsen. Auf Huegeln wachsen vor allem Kiefern.
  for (const [k, cell] of cells) {
    if (cell.ch !== 'g' || inTown(...(k.split(',').map(Number) as [number, number]))) continue;
    const [c, r] = k.split(',').map(Number);
    // Direkt am Plateau keine Baeume, sonst verschwindet die Stadtkante dahinter.
    if (townDist(c, r) <= 1) continue;
    const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => cells.get(cellKey(c + dc, r + dr))?.ch === 'p');
    const n = noise(c, r);
    const forest = smooth(c, r, 6, 3) > 0.62;
    if (cell.h > 0) cell.ch = n < 0.45 ? 'P' : n < 0.6 ? 'T' : n < 0.66 ? 'R' : 'g';
    else if (forest && !nearPath) cell.ch = n < 0.3 ? 'T' : n < 0.5 ? 'P' : n < 0.65 ? 't' : 'g';
    else if (n < 0.05) cell.ch = 't';
    else if (n < 0.07 && !nearPath) cell.ch = 'T';
    else if (n < 0.1) cell.ch = 'b';
    else if (n < 0.115) cell.ch = 'R';
  }

  const animals = ANIMALS.map(a => {
    const t = towns.find(t => t.id === a.town)!;
    return { emoji: a.emoji, threshold: a.threshold, c: t.c + a.c, r: t.r + a.r, z: t.h };
  });

  return { pieces: buildCells(cells, houses), towns, animals };
};

// Das Seitenverhaeltnis wird gerundet, damit nicht jedes Pixel beim Drehen
// oder Groessenaendern eine neue Karte baut.
const cache = new Map<string, MapLayout>();
export const mapLayout = (aspect: number) => {
  const kind = layoutFor(aspect);
  const a = Math.round(aspect * 10) / 10;
  const key = `${kind}:${a}`;
  if (!cache.has(key)) cache.set(key, build(kind, a));
  return cache.get(key)!;
};
