import type { Piece } from './IsoScene';
import { LL, LR, UL, UR, pathTile, type Dir } from './tiles';

// Eine Szene wird als Text-Gitter beschrieben — so sieht man im Code ungefaehr,
// wie die Insel aussieht. Zeile = r (nach links unten), Spalte = c (nach rechts unten).
//
//   .  nichts (Luft)        g  Wiese          p  Weg (verbindet sich selbst)
//   o  Wasser               t  Wiese mit Baum
//   T  Wiese mit Baumgruppe b  Wiese mit Busch d  Erde
//   x  Wiese mit Baugeruest   w  Weizenfeld     W  Brunnen
//   P  grosse Kiefer
export interface House {
  c: number; r: number;
  // Stockwerke von unten nach oben, ohne Richtungs-Endung, z. B. 'building_doorWindows'.
  floors: string[];
  roof?: string;  // z. B. 'roof_gableBrown'; ohne Dach fuer Mauern und Gerueste
  dir?: Dir;      // Blickrichtung der Tuer, Standard N (Tuer vorn rechts)
  roofDir?: Dir;
}

export interface SceneSpec {
  ground: string[];
  houses?: House[];
  // Stelzen unter dem vorderen Rand — die Insel schwebt dann wie im Kenney-Beispiel.
  stilts?: boolean;
}

// ── Zellen ──
// Fuer Szenen mit Hoehenstufen (die grosse Karte mit erhoehten Staedten) wird
// das Text-Gitter in einzelne Zellen zerlegt; jede kennt ihre Hoehe.
export interface Cell {
  ch: string;
  h: number;      // Oberkante der Zelle in Stockwerken, 0 = Grundebene
  ramp?: Dir;     // Weg-Rampe eine Stufe hinauf; Richtung wie bei Kenney (E = steigt nach hinten rechts)
  floor?: string; // Kachel fuer freien Boden statt Wiese, z. B. Pflaster
  under?: string; // Kachel fuer die Bloecke unter der Oberflaeche, Standard Erde
}
export type Cells = Map<string, Cell>;
export const cellKey = (c: number, r: number) => `${c},${r}`;

// Traegt ein Text-Gitter ab Versatz (oc, or) auf Hoehe h in `into` ein;
// `extra` gilt fuer alle Zellen (z. B. anderer Boden).
export const addGrid = (into: Cells, ground: string[], h = 0, oc = 0, or = 0, extra: Partial<Cell> = {}) => {
  ground.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') into.set(cellKey(oc + c, or + r), { ...extra, ch, h });
  }));
  return into;
};

export const buildCells = (cells: Cells, houses: House[] = [], stilts = true): Piece[] => {
  const out: Piece[] = [];
  const get = (c: number, r: number) => cells.get(cellKey(c, r));

  // Wege verbinden sich nur auf gleicher Hoehe — eine Rampe zaehlt fuer die
  // untere Seite als Weg, die obere Seite erreicht sie ueber die Stufe.
  const isPath = (c: number, r: number, h: number) => {
    const n = get(c, r);
    return !!n && n.ch === 'p' && (n.h === h || (!!n.ramp && n.h + 1 === h));
  };
  const mask = (c: number, r: number, h: number) =>
    (isPath(c - 1, r, h) ? UL : 0) | (isPath(c, r - 1, h) ? UR : 0) |
    (isPath(c + 1, r, h) ? LR : 0) | (isPath(c, r + 1, h) ? LL : 0);

  for (const [k, cell] of cells) {
    const [c, r] = k.split(',').map(Number);
    const { ch, h } = cell;
    const put = (tile: string, z: number) => out.push({ tile, c, r, z });

    // Wasser liegt eine Stufe tiefer als das Land drumherum — als volle
    // Wuerfel auf Bodenhoehe sah es aus wie Glasbausteine.
    const top = ch === 'o' ? h - 1 : h;
    for (let z = 0; z < top; z++) put(cell.under ?? 'dirt_center_N', z);
    if (cell.ramp) {
      put('grass_center_N', h);
      put(`grass_pathSlope_${cell.ramp}`, h + 1);
    } else if (ch === 'p') put(pathTile(mask(c, r, h)), h);
    else if (ch === 'o') put('water_center_N', top);
    else if (ch === 'd') put('dirt_center_N', h);
    else put((ch === 'g' || ch === 'W') && cell.floor ? cell.floor : 'grass_center_N', h);

    if (ch === 't') put('tree_single_N', h + 1);
    if (ch === 'T') put('tree_multiple_N', h + 1);
    if (ch === 'b') put('rocks_grass_N', h + 1);
    if (ch === 'x') put('structure_low_N', h + 1);
    if (ch === 'w') put('furrow_cropWheat_N', h + 1);
    if (ch === 'W') put('well_E', h + 1);
    if (ch === 'P') put('tree_pineLarge_N', h + 1);

    // Nur wo vorn nichts mehr kommt, sieht man die Stelzen ueberhaupt.
    if (stilts && (!get(c + 1, r) || !get(c, r + 1))) put('structure_high_N', Math.min(-1, top - 1));
  }

  for (const hs of houses) {
    const dir = hs.dir ?? 'N';
    const z0 = (get(hs.c, hs.r)?.h ?? 0) + 1;
    hs.floors.forEach((f, i) => out.push({ tile: `${f}_${dir}`, c: hs.c, r: hs.r, z: z0 + i }));
    if (hs.roof) out.push({ tile: `${hs.roof}_${hs.roofDir ?? dir}`, c: hs.c, r: hs.r, z: z0 + hs.floors.length });
  }
  return out;
};

export const buildScene = ({ ground, houses = [], stilts = true }: SceneSpec): Piece[] =>
  buildCells(addGrid(new Map(), ground), houses, stilts);
