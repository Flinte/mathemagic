import { ArrowLeft, Star } from 'lucide-react';
import { IsoScene } from '../iso/IsoScene';
import { GAMES, isPlayable, type Category, type GameId } from './games';
import type { Town } from './towns';
import { TOWN_PIECES } from './islands';
import { IslandAnimals } from './IslandAnimals';

interface Props {
  town: Town;
  stickers: Record<string, string[]>;
  totalStickers: number;
  onPlay: (game: Category) => void;
  onBack: () => void;
}

// Eine Siedlung: oben bzw. links die Insel, daneben die Liste ihrer Spiele.
// Die Liste ist der verlaessliche Weg ins Spiel — auf dem Handy sind die Haeuser
// auf der Insel klein, die Schilder darauf zeigen nur das Zeichen.
export const TownView = ({ town, stickers, totalStickers, onPlay, onBack }: Props) => {
  const games = town.scene.houses.flatMap(h => (h.game ? [h.game] : []));
  const open = (g: GameId) => { if (isPlayable(g)) onPlay(g); };

  return (
    <div className="town-screen">
      <header className="town-header">
        <button className="back-button-small" onClick={onBack} aria-label="Zurück zur Karte"><ArrowLeft size={20} /></button>
        <span className="town-title">{town.icon} {town.name}</span>
      </header>

      <div className="town-body">
        <div className="town-island">
          <IsoScene
            pieces={TOWN_PIECES[town.id]}
            maxScale={0.75}
            overlay={place => (
              <>
                <IslandAnimals place={place} town={town.id} stickers={totalStickers} />
                {town.scene.houses.filter(h => h.game).map(h => {
                  const g = GAMES[h.game!];
                  // Schild sitzt auf der Dachspitze bzw. auf dem obersten Stockwerk.
                  const { left, top } = place(h.c, h.r, h.floors.length + (h.roof ? 1 : 0.2));
                  return (
                    <button
                      key={h.game}
                      className={`house-sign ${g.planned ? 'planned' : ''}`}
                      style={{ left, top, borderColor: g.color }}
                      onClick={() => open(h.game!)}
                      title={g.label}
                    >
                      {g.planned ? '🚧' : g.icon}
                    </button>
                  );
                })}
              </>
            )}
          />
        </div>

        <ul className="town-games">
          {games.map(id => {
            const g = GAMES[id];
            const n = stickers[id]?.length ?? 0;
            return (
              <li key={id}>
                <button
                  className={`game-card ${g.planned ? 'planned' : ''}`}
                  style={{ borderLeftColor: g.color }}
                  onClick={() => open(id)}
                  disabled={g.planned}
                >
                  <span className="game-card-icon">{g.icon}</span>
                  <span className="game-card-label">{g.label}</span>
                  <span className="game-card-klasse">Kl. {g.klasse}</span>
                  {g.planned
                    ? <span className="game-card-soon">🚧 bald</span>
                    : <span className="game-card-stars"><Star size={14} fill={n ? '#f59e0b' : 'none'} stroke={n ? 'none' : '#cbd5e1'} />{n}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
