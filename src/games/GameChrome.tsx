import { ArrowLeft, Star } from 'lucide-react';
import { GAMES, type GameId } from '../world/games';

// Kopfzeile und Sternchen-Fortschritt — gleich in jedem Spiel.

export const GameHeader = ({ category, onBack }: { category: GameId; onBack: () => void }) => {
  const b = GAMES[category];
  return (
    <div className="game-header" style={{ background: b.color }}>
      <button className="back-button-small" onClick={onBack}><ArrowLeft size={20} /></button>
      <span className="game-header-icon">{b.icon}</span>
      <span className="game-header-title">{b.label}</span>
    </div>
  );
};

export const StarProgress = ({ solved, total }: { solved: number; total: number }) => (
  <div className="star-progress">
    {Array.from({ length: total }, (_, i) => (
      <Star key={i} size={28}
        fill={i < solved ? '#f59e0b' : 'none'}
        stroke={i < solved ? '#f59e0b' : '#d1d5db'}
        strokeWidth={i < solved ? 0 : 2}
      />
    ))}
  </div>
);