import { ArrowLeft, Star } from 'lucide-react';
import { GAMES, isPlayable, type Category, type GameId } from './games';
import { EXAMS, daysUntil, formatDate, nextExam, type Exam } from './exams';

interface Props {
  stickers: Record<string, string[]>;
  onPlay: (game: Category) => void;
  onBack: () => void;
}

const GameChip = ({ id, stickers, onPlay }: { id: GameId; stickers: Record<string, string[]>; onPlay: (g: Category) => void }) => {
  const g = GAMES[id];
  const n = stickers[id]?.length ?? 0;
  return (
    <button
      className={`topic-chip ${g.planned ? 'planned' : ''}`}
      style={{ background: g.planned ? undefined : g.color }}
      disabled={g.planned}
      onClick={() => { if (isPlayable(id)) onPlay(id); }}
    >
      {g.icon} {g.label}
      {g.planned ? ' 🚧' : n > 0 && <span className="topic-chip-stars"><Star size={11} fill="#fff" stroke="none" />{n}</span>}
    </button>
  );
};

const TopicList = ({ exam, stickers, onPlay }: { exam: Exam } & Omit<Props, 'onBack'>) => (
  <ul className="topic-list">
    {exam.topics.map(t => (
      <li key={t.text}>
        <span className="topic-text">{t.text}</span>
        <span className="topic-games">
          {t.games.map(id => <GameChip key={id} id={id} stickers={stickers} onPlay={onPlay} />)}
        </span>
      </li>
    ))}
  </ul>
);

// Die Schule zeigt den Lernzettel der naechsten Arbeit — so, wie er auf dem
// Papier steht, jede Zeile fuehrt direkt zur passenden Uebung.
export const SchoolView = ({ stickers, onPlay, onBack }: Props) => {
  const exam = nextExam();
  const earlier = EXAMS.filter(e => e !== exam);
  const days = exam ? daysUntil(exam) : 0;

  return (
    <div className="school-screen">
      <header className="town-header">
        <button className="back-button-small" onClick={onBack} aria-label="Zurück zur Karte"><ArrowLeft size={20} /></button>
        <span className="town-title">🏫 Schule</span>
      </header>

      <div className="school-body">
        {exam ? (
          <section className="lernzettel">
            <h2>Themen für die Mathearbeit am {formatDate(exam)}</h2>
            <p className="lernzettel-days">
              {days === 0 ? 'Heute ist die Arbeit — viel Glück! 🍀' : days === 1 ? 'Morgen ist es so weit!' : `Noch ${days} Tage zum Üben`}
            </p>
            <TopicList exam={exam} stickers={stickers} onPlay={onPlay} />
            <div className="lernzettel-probe">
              <GameChip id="probearbeit" stickers={stickers} onPlay={onPlay} />
              <span>Alle Themen gemischt — wie in der echten Arbeit.</span>
            </div>
          </section>
        ) : (
          <section className="lernzettel"><h2>Gerade steht keine Arbeit an. 🎉</h2></section>
        )}

        {earlier.length > 0 && (
          <details className="earlier-exams">
            <summary>Frühere Arbeiten</summary>
            {earlier.map(e => (
              <section key={e.date} className="lernzettel small">
                <h3>Mathearbeit am {formatDate(e)}</h3>
                <TopicList exam={e} stickers={stickers} onPlay={onPlay} />
              </section>
            ))}
          </details>
        )}
      </div>
    </div>
  );
};
