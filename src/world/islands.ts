import { addGrid, buildCells } from '../iso/build';
import { TOWNS, TOWN_GROUND, type TownId } from './towns';

// Der Panda ist das Maskottchen der Klasse 3b und wohnt von Anfang an in der
// Schule — Schwelle 0. Alle anderen Tiere ziehen nach und nach auf die Inseln.
export const ANIMALS: { threshold: number; emoji: string; town: TownId; c: number; r: number }[] = [
  { threshold: 0,  emoji: '🐼', town: 'schule',    c: 4, r: 5 },
  { threshold: 5,  emoji: '🐰', town: 'plusminus', c: 1, r: 6 },
  { threshold: 10, emoji: '🦌', town: 'mal',       c: 6, r: 0 },
  { threshold: 15, emoji: '🦊', town: 'raetsel',   c: 6, r: 6 },
  { threshold: 20, emoji: '🐿️', town: 'teilen',    c: 5, r: 6 },
  { threshold: 25, emoji: '🦔', town: 'markt',     c: 5, r: 6 },
  { threshold: 30, emoji: '🦄', town: 'tausend',   c: 6, r: 7 },
];

export const currentAnimal = (stickers: number) =>
  [...ANIMALS].reverse().find(a => stickers >= a.threshold) ?? ANIMALS[0];

export const TOWN_PIECES = Object.fromEntries(TOWNS.map(t =>
  [t.id, buildCells(addGrid(new Map(), t.scene.ground, 0, 0, 0, TOWN_GROUND), t.scene.houses)]));
