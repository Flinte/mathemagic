import type { Cell, House, SceneSpec } from '../iso/build';
import type { GameId } from './games';

// Jede Siedlung ist ein erhoehtes Plateau auf der Landkarte; angetippt fuellt
// sie den Bildschirm. Es ist dieselbe Szene, damit man sie wiedererkennt.
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
  height?: number;   // Stufen ueber der Wiese auf der Karte, Standard 1
  scene: Omit<SceneSpec, 'houses'> & { houses: TownHouse[] };
}

// Staedte sind gepflastert — so heben sie sich auf der Karte von der Wiese ab.
// Baeume, Buesche und Wege behalten ihren eigenen Boden.
export const TOWN_GROUND: Partial<Cell> = { floor: 'castle_center_N' };

export const TOWNS: Town[] = [
  {
    // Bauernhof: Weizenfelder, Teich, Brunnen
    id: 'plusminus', name: 'Plus-Minus-Hof', icon: '🌾',
    scene: {
      ground: [
        'TgggwwwT',
        'gpppwwwg',
        'gpggwwwg',
        'gpppppgg',
        'tgggopgb',
        'gWggoppg',
        'Tgbgggpt',
        'ggggggpg',
      ],
      houses: [
        { c: 0, r: 2, game: 'plus', floors: ['building_doorWindows'], roof: 'roof_gableGreen' },
        { c: 3, r: 0, game: 'minus', floors: ['building_door', 'building_windows', 'building_window'], roof: 'roof_pointGreen' },
        { c: 2, r: 2, game: 'verdoppeln-halbieren', floors: ['building_doorWindowsBeige'], roof: 'roof_roundedGreen' },
        { c: 3, r: 4, game: 'differenz-jagd', floors: ['building_doorBeige'], roof: 'roof_slantGreen' },
        { c: 7, r: 3, game: 'zahlen-mauer', floors: ['castle_wall'] },
        { c: 0, r: 0, floors: ['building_centerBeige'], roof: 'roof_gableBrown' },
      ],
    },
  },
  {
    // Lila Dorf um einen Brunnen
    id: 'mal', name: 'Mal-Dorf', icon: '✖️',
    scene: {
      ground: [
        'TggggggT',
        'gpppppgg',
        'gpggbpgg',
        'gpggWpgt',
        'gppppppg',
        'tggpgggg',
        'gggpgggT',
        'Tggpgggg',
      ],
      houses: [
        { c: 0, r: 2, game: 'einmaleins-klein', floors: ['building_doorWindows'], roof: 'roof_gablePurple' },
        { c: 2, r: 0, game: 'einmaleins-gross', floors: ['building_doorWindows', 'building_windows'], roof: 'roof_gablePurple' },
        { c: 2, r: 2, game: 'einmaleins-tafel', floors: ['building_doorWindowsBeige'], roof: 'roof_slantPurple' },
        { c: 6, r: 1, game: 'kernaufgaben', floors: ['building_door', 'building_windows'], roof: 'roof_pointPurple' },
        { c: 5, r: 5, game: 'tausch-arena', floors: ['castle_gateOpen'], roof: 'roof_roundedPurple' },
        { c: 6, r: 3, floors: ['building_windowBeige'], roof: 'roof_gablePurple' },
        { c: 1, r: 6, floors: ['building_centerBeige'], roof: 'roof_slantPurple' },
      ],
    },
  },
  {
    id: 'teilen', name: 'Teil-Dorf', icon: '➗',
    scene: {
      ground: [
        'TgggggT',
        'gpppppg',
        'gpgggpg',
        'gpgWgpg',
        'gpppppg',
        'tggpggb',
        'Tggpggt',
      ],
      houses: [
        { c: 2, r: 0, game: 'division', floors: ['building_doorWindows', 'building_windows'], roof: 'roof_gableBrown' },
        { c: 0, r: 2, game: 'division-zerlegen', floors: ['building_doorWindowsBeige'], roof: 'roof_slantBrown' },
        { c: 6, r: 2, game: 'division-rest', floors: ['building_door'], roof: 'roof_roundBrown' },
        { c: 3, r: 2, floors: ['building_centerBeige'], roof: 'roof_gableBrown' },
        { c: 5, r: 5, floors: ['building_windowBeige'], roof: 'roof_slantBrown' },
      ],
    },
  },
  {
    // Die Stadt: hohe Haeuser um einen Brunnenplatz
    id: 'tausend', name: 'Tausender-Stadt', icon: '🏙️',
    scene: {
      ground: [
        'gggggggg',
        'gppppppg',
        'gpggggpg',
        'gpgWggpg',
        'gpggggpg',
        'gppppppg',
        'tggpgggT',
        'Tggpgggg',
      ],
      houses: [
        { c: 0, r: 0, game: 'stellenwert', floors: ['building_doorWindowsBeige', 'building_stackBeige', 'building_stackBeige'], roof: 'roof_gableBeige' },
        { c: 6, r: 0, game: 'tausender-streifen', floors: ['building_doorWindows', 'building_stack', 'building_stack'], roof: 'roof_slantGreen' },
        { c: 0, r: 4, game: 'zahlenstrahl', floors: ['structure_arch'], roof: 'roof_roundedGreen' },
        { c: 7, r: 4, game: 'runden', floors: ['castle_tower', 'castle_window', 'castle_window'], roof: 'roof_pointBeige' },
        { c: 2, r: 2, floors: ['building_stack', 'building_stack', 'building_stack', 'building_stack'], roof: 'roof_slantBeige' },
        { c: 5, r: 2, floors: ['building_stackBeige', 'building_stackBeige', 'building_stackBeige'], roof: 'roof_gableBrown' },
        { c: 2, r: 4, floors: ['building_stackBeige', 'building_stackBeige'], roof: 'roof_gableBeige' },
        { c: 5, r: 4, floors: ['building_stack', 'building_stack', 'building_stack'], roof: 'roof_slantGreen' },
        { c: 3, r: 0, floors: ['building_stack', 'building_stack'], roof: 'roof_gableBrown' },
      ],
    },
  },
  {
    // Erdplatz mit Brunnen und Marktstaenden
    id: 'markt', name: 'Marktplatz', icon: '🛒',
    scene: {
      ground: [
        'TgggggT',
        'gpppppg',
        'gpdddpg',
        'gpdWdpg',
        'gpdddpg',
        'gpppppg',
        'tggpggb',
      ],
      houses: [
        { c: 0, r: 2, game: 'geld', floors: ['building_doorWindowsBeige'], roof: 'roof_roundedGreen' },
        { c: 6, r: 2, game: 'uhrzeit', floors: ['building_door', 'building_windowsBeige', 'building_windowBeige'], roof: 'roof_churchBeige' },
        { c: 0, r: 4, game: 'sachaufgaben', floors: ['building_doorWindowsBeige'], roof: 'roof_gableBeige' },
        { c: 2, r: 2, floors: ['structure_low'], roof: 'roof_slantGreen' },
        { c: 4, r: 4, floors: ['structure_low'], roof: 'roof_slantBrown' },
        { c: 4, r: 2, floors: ['structure_low'], roof: 'roof_slantPurple' },
      ],
    },
  },
  {
    // Zwei Stufen hoch, mit Kiefernwald
    id: 'raetsel', name: 'Rätsel-Berg', icon: '⛰️', height: 2,
    scene: {
      ground: [
        'TPgggPPT',
        'gpppppPg',
        'gpgggpgg',
        'gpgbgpgP',
        'gpppppgg',
        'PggpgggP',
        'gPgpgbgg',
        'TggpgggP',
      ],
      houses: [
        { c: 0, r: 2, game: 'platzhalter', floors: ['castle_tower', 'castle_window'], roof: 'roof_pointBrown' },
        { c: 6, r: 2, game: 'punkt-vor-strich', floors: ['building_doorWindows', 'building_windows'], roof: 'roof_gableBrown' },
        { c: 2, r: 2, game: 'zahlen-fabrik', floors: ['building_doorWindowsBeige'], roof: 'roof_slantBrown' },
        { c: 6, r: 4, game: 'meister-zelt', floors: ['structure_arch'], roof: 'roof_roundedBeige' },
        { c: 2, r: 0, floors: ['castle_tower'], roof: 'roof_pointBeige' },
      ],
    },
  },
];

// Die Schule ist keine Siedlung mit Spielen, sondern der Weg zum Lernzettel.
// Ein Hauptgebaeude mit Glockendach und zwei Fluegeln.
export const SCHOOL_SCENE: SceneSpec = {
  ground: [
    'TgggggT',
    'gpppppg',
    'gpgggpg',
    'gpgggpg',
    'gpppppg',
    'tgbpgbt',
    'Tggpggg',
  ],
  houses: [
    { c: 3, r: 2, floors: ['building_doorWindows', 'building_windows', 'building_windows'], roof: 'roof_churchPurple' },
    { c: 2, r: 2, floors: ['building_windows', 'building_windows'], roof: 'roof_gablePurple' },
    { c: 4, r: 2, floors: ['building_windows', 'building_windows'], roof: 'roof_gablePurple' },
    { c: 0, r: 0, floors: ['building_door'], roof: 'roof_slantPurple' },
  ],
};

export const townOf = (game: GameId): Town | undefined =>
  TOWNS.find(t => t.scene.houses.some(h => h.game === game));
