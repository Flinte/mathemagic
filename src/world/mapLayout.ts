import type { Piece } from '../iso/IsoScene';
import { addGrid, buildCells, cellKey, type Cells, type House } from '../iso/build';
import { ANIMALS } from './islands';
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

const STEP = 8;   // Gitterfelder je Stadt-Schritt (Staedte sind bis zu 6 gross)
const PAD = 3;    // Wiese rund um jede Stadt

export interface PlacedTown { id: TownId; c: number; r: number; size: number; }
export interface MapLayout {
  pieces: Piece[];
  towns: PlacedTown[];
  animals: { emoji: string; threshold: number; c: number; r: number; z: number }[];
}

const sceneOf = (id: TownId) => (id === 'schule' ? SCHOOL_SCENE : TOWNS.find(t => t.id === id)!.scene);

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

const build = (kind: LayoutKind): MapLayout => {
  // 1. Staedte platzieren
  const towns: PlacedTown[] = SLOTS[kind].map(([id, i, j]) => {
    const size = sceneOf(id).ground.length;
    const off = Math.floor((6 - size) / 2);   // kleinere Staedte mittig im Platz
    return { id, c: Math.round((i + j) * STEP) + off, r: Math.round((j - i) * STEP) + off, size };
  });
  const minC = Math.min(...towns.map(t => t.c)) - PAD;
  const minR = Math.min(...towns.map(t => t.r)) - PAD;
  for (const t of towns) { t.c -= minC; t.r -= minR; }
  const W = Math.max(...towns.map(t => t.c + t.size)) + PAD;
  const H = Math.max(...towns.map(t => t.r + t.size)) + PAD;

  const inTown = (c: number, r: number) => towns.some(t => c >= t.c && c < t.c + t.size && r >= t.r && r < t.r + t.size);
  // Abstand (in Feldern) zur naechsten Stadt
  const townDist = (c: number, r: number) => Math.min(...towns.map(t =>
    Math.max(t.c - c, c - (t.c + t.size - 1), t.r - r, r - (t.r + t.size - 1), 0)));

  // 2. Land: ein auf dem Bildschirm rechteckiges Stueck Wiese um alle Staedte.
  // Auf dem Bildschirm ist x ~ c − r und y ~ c + r; begrenzt wird also in
  // diesen beiden Richtungen, nicht in c und r.
  const corners = towns.flatMap(t => [[t.c, t.r], [t.c + t.size - 1, t.r], [t.c, t.r + t.size - 1], [t.c + t.size - 1, t.r + t.size - 1]]);
  const u0 = Math.min(...corners.map(([c, r]) => c - r)) - PAD, u1 = Math.max(...corners.map(([c, r]) => c - r)) + PAD;
  const v0 = Math.min(...corners.map(([c, r]) => c + r)) - PAD, v1 = Math.max(...corners.map(([c, r]) => c + r)) + PAD;
  const cells: Cells = new Map();
  for (let r = -W; r < H + W; r++) for (let c = -H; c < W + H; c++) {
    const u = c - r, v = c + r;
    if (u >= u0 && u <= u1 && v >= v0 && v <= v1) cells.set(cellKey(c, r), { ch: 'g', h: 0 });
  }

  // Seen dort, wo weit und breit keine Stadt ist — Teich-Mittelpunkte aus dem
  // festen Zufall, je ein kleines Rund drumherum.
  for (const k of cells.keys()) {
    const [c, r] = k.split(',').map(Number);
    if (noise(c * 3 + 1, r * 7 + 2) > 0.035 || townDist(c, r) < 5) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -2; dc <= 1; dc++) {
      const n = cells.get(cellKey(c + dc, r + dr));
      if (n && townDist(c + dc, r + dr) >= 3 && Math.abs(dc + 0.5) + Math.abs(dr) < 2.6) n.ch = 'o';
    }
  }

  // 3. Staedte als Plateau eine Stufe hoeher, Rampe vor dem Tor
  const houses: House[] = [];
  const feet: [number, number][] = [];
  for (const t of towns) {
    const scene = sceneOf(t.id);
    addGrid(cells, scene.ground, 1, t.c, t.r, TOWN_GROUND);
    for (const h of scene.houses ?? []) houses.push({ ...h, c: h.c + t.c, r: h.r + t.r });
    const g = gateOf(scene.ground);
    cells.set(cellKey(t.c + g.c, t.r + g.r + 1), { ch: 'p', h: 0, ramp: 'E' });
    feet.push([t.c + g.c, t.r + g.r + 2]);
  }

  // 4. Wege: jede Stadt an die naechste schon verbundene (wie ein Spannbaum)
  const isRamp = (c: number, r: number) => !!cells.get(cellKey(c, r))?.ramp;
  const free = (c: number, r: number) => {
    const cell = cells.get(cellKey(c, r));
    return !!cell && cell.h === 0 && cell.ch !== 'o' && !cell.ramp && !inTown(c, r)
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
    for (const [c, r] of route(free, feet[b], feet[a])) cells.set(cellKey(c, r), { ch: 'p', h: 0 });
    linked.push(b);
  }

  // 5. Baeume und Buesche auf der freien Wiese
  for (const [k, cell] of cells) {
    if (cell.h !== 0 || cell.ch !== 'g') continue;
    const [c, r] = k.split(',').map(Number);
    const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => cells.get(cellKey(c + dc, r + dr))?.ch === 'p');
    // Direkt am Plateau keine Baeume, sonst verschwindet die Stadtkante dahinter.
    if (townDist(c, r) <= 1) continue;
    const n = noise(c, r);
    if (n < 0.07) cell.ch = 't';
    else if (n < 0.1 && !nearPath) cell.ch = 'T';
    else if (n < 0.13) cell.ch = 'b';
  }

  const animals = ANIMALS.map(a => {
    const t = towns.find(t => t.id === a.town)!;
    return { emoji: a.emoji, threshold: a.threshold, c: t.c + a.c, r: t.r + a.r, z: 2 };
  });

  return { pieces: buildCells(cells, houses), towns, animals };
};

const cache = new Map<LayoutKind, MapLayout>();
export const mapLayout = (kind: LayoutKind) => {
  if (!cache.has(kind)) cache.set(kind, build(kind));
  return cache.get(kind)!;
};
