import type { Cell, House, SceneSpec } from '../iso/build';
import type { GameId } from './games';

// Jede Siedlung ist eine schwebende Insel. Auf der Uebersicht erscheint sie
// klein, angetippt fuellt sie den Bildschirm — es ist dieselbe Szene, damit man
// die Insel beim Hineingehen wiedererkennt.
//
// Gitter: Zeile = r (laeuft nach links unten), Spalte = c (nach rechts unten).
// Die Kachel (0,0) ist also die hinterste Ecke oben.

export type TownId = 'schule' | 'plusminus' | 'mal' | 'teilen' | 'tausend' | 'markt' | 'raetsel';

// Ein Haus mit `game` fuehrt zu einem Spiel, eines ohne ist nur Kulisse.
export interface TownHouse extends House { game?: GameId; }

export interface Town {
  id: TownId;
  name: string;
  icon: string;
  scene: Omit<SceneSpec, 'houses'> & { houses: TownHouse[] };
}

// Staedte sind gepflastert — so heben sie sich auf der Karte von der Wiese ab.
// Baeume, Buesche und Wege behalten ihren eigenen Boden.
export const TOWN_GROUND: Partial<Cell> = { floor: 'castle_center_N' };

// Ein Spiel, das noch gebaut wird, steht als Geruest ohne Dach da.
const baustelle = (c: number, r: number, game: GameId): TownHouse =>
  ({ c, r, game, floors: ['structure_low'] });

export const TOWNS: Town[] = [
  {
    id: 'plusminus', name: 'Plus-Minus-Hof', icon: '🌾',
    scene: {
      ground: [
        'gggTgg',
        'gpppgg',
        'gpggoo',
        'gpppoo',
        'tggpgg',
        'Tgbpgt',
      ],
      houses: [
        { c: 0, r: 1, game: 'plus', floors: ['building_doorWindows'], roof: 'roof_gableGreen' },
        { c: 4, r: 1, game: 'minus', floors: ['building_door', 'building_windows', 'building_window'], roof: 'roof_pointGreen' },
        { c: 2, r: 2, game: 'verdoppeln-halbieren', floors: ['building_doorWindowsBeige'], roof: 'roof_roundedGreen' },
        { c: 5, r: 1, game: 'differenz-jagd', floors: ['building_doorBeige'], roof: 'roof_slantGreen' },
        { c: 4, r: 4, game: 'zahlen-mauer', floors: ['castle_wall'] },
      ],
    },
  },
  {
    id: 'mal', name: 'Mal-Dorf', icon: '✖️',
    scene: {
      ground: [
        'tgggTg',
        'gpppgg',
        'gpgpgt',
        'gppppg',
        'ggpggb',
        'Tgpggg',
      ],
      houses: [
        { c: 0, r: 2, game: 'einmaleins-klein', floors: ['building_doorWindows'], roof: 'roof_gablePurple' },
        { c: 2, r: 0, game: 'einmaleins-gross', floors: ['building_doorWindows', 'building_windows'], roof: 'roof_gablePurple' },
        { c: 2, r: 2, game: 'einmaleins-tafel', floors: ['building_doorWindowsBeige'], roof: 'roof_slantPurple' },
        { c: 4, r: 1, game: 'kernaufgaben', floors: ['building_door'], roof: 'roof_pointPurple' },
        { c: 4, r: 4, game: 'tausch-arena', floors: ['castle_gateOpen'], roof: 'roof_roundedPurple' },
      ],
    },
  },
  {
    id: 'teilen', name: 'Teil-Dorf', icon: '➗',
    scene: {
      ground: [
        'Tggtg',
        'gpppg',
        'gpgpg',
        'gpppT',
        'tgpgg',
      ],
      houses: [
        { c: 2, r: 0, game: 'division', floors: ['building_doorWindows', 'building_windows'], roof: 'roof_gableBrown' },
        { c: 0, r: 2, game: 'division-zerlegen', floors: ['building_doorWindowsBeige'], roof: 'roof_slantBrown' },
        { c: 2, r: 2, game: 'division-rest', floors: ['building_door'], roof: 'roof_roundBrown' },
      ],
    },
  },
  {
    id: 'tausend', name: 'Tausender-Stadt', icon: '🏙️',
    scene: {
      ground: [
        'ggdggt',
        'gppppg',
        'gpggpg',
        'gpggpg',
        'gppppg',
        'Tgdgpg',
      ],
      houses: [
        baustelle(0, 0, 'stellenwert'),
        baustelle(3, 0, 'tausender-streifen'),
        baustelle(2, 2, 'zahlenstrahl'),
        baustelle(5, 3, 'runden'),
        { c: 3, r: 2, floors: ['building_center', 'building_center'], roof: 'roof_slantBeige' },
      ],
    },
  },
  {
    id: 'markt', name: 'Marktplatz', icon: '🛒',
    scene: {
      ground: [
        'tgggT',
        'gpppg',
        'gpdpg',
        'gpppg',
        'bgpgt',
      ],
      houses: [
        baustelle(1, 0, 'geld'),
        { c: 4, r: 1, game: 'uhrzeit', floors: ['building_door', 'building_windowsBeige', 'building_windowBeige'], roof: 'roof_churchBeige' },
        { c: 0, r: 2, game: 'sachaufgaben', floors: ['building_doorWindowsBeige'], roof: 'roof_gableBeige' },
      ],
    },
  },
  {
    id: 'raetsel', name: 'Rätsel-Berg', icon: '⛰️',
    scene: {
      ground: [
        'TgggTg',
        'gpppgg',
        'gpgppt',
        'gpgggg',
        'gppppb',
        'tgggpg',
      ],
      houses: [
        { c: 0, r: 0, game: 'platzhalter', floors: ['castle_tower', 'castle_window'], roof: 'roof_pointBrown' },
        { c: 3, r: 0, game: 'punkt-vor-strich', floors: ['building_doorWindows', 'building_windows'], roof: 'roof_gableBrown' },
        { c: 2, r: 3, game: 'zahlen-fabrik', floors: ['building_doorWindowsBeige'], roof: 'roof_slantBrown' },
        { c: 5, r: 3, game: 'meister-zelt', floors: ['structure_arch'], roof: 'roof_roundedBeige' },
      ],
    },
  },
];

// Die Schule ist keine Siedlung mit Spielen, sondern der Weg zum Lernzettel.
export const SCHOOL_SCENE: SceneSpec = {
  ground: [
    'tgggT',
    'gpppg',
    'gpgpg',
    'gpppg',
    'Tgpgt',
  ],
  houses: [
    { c: 2, r: 2, floors: ['building_doorWindows', 'building_windows'], roof: 'roof_churchPurple' },
    { c: 0, r: 0, floors: ['building_door'], roof: 'roof_gablePurple' },
  ],
};

export const townOf = (game: GameId): Town | undefined =>
  TOWNS.find(t => t.scene.houses.some(h => h.game === game));
