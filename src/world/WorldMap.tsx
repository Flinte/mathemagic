import { useLayoutEffect, useRef, useState } from 'react';
import { Star, Trash2, Volume2, VolumeX } from 'lucide-react';
import { isSoundOn, setSoundOn } from '../games/shared';
import { IsoScene } from '../iso/IsoScene';
import { TOWNS, type TownId } from './towns';
import { currentAnimal } from './islands';
import { mapLayout } from './mapLayout';
import { daysUntil, formatDate, nextExam } from './exams';

interface Props {
  stickers: Record<string, string[]>;
  onOpenTown: (id: TownId) => void;
  onOpenSchool: () => void;
  onReset: () => void;
}

// Auf dem Ortsschild steht nur der Name, das Zeichen weht auf der Fahne.
const NAMES = { schule: 'Schule', ...Object.fromEntries(TOWNS.map(t => [t.id, t.name])) } as Record<TownId, string>;
const ICONS = { schule: '🏫', ...Object.fromEntries(TOWNS.map(t => [t.id, t.icon])) } as Record<TownId, string>;

// Die Landkarte fuellt den ganzen Bildschirm unter dem Kopf. Welche Anordnung
// der Staedte passt, entscheidet das Seitenverhaeltnis dieser Flaeche.
export const WorldMap = ({ stickers, onOpenTown, onOpenSchool, onReset }: Props) => {
  const total = Object.values(stickers).flat().length;
  const exam = nextExam();
  const days = exam ? daysUntil(exam) : 0;

  const [sound, setSound] = useState(isSoundOn);
  const toggleSound = () => { setSoundOn(!sound); setSound(!sound); };

  const frameRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(0);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAspect(e.contentRect.width / Math.max(1, e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = aspect ? mapLayout(aspect) : null;

  const open = (id: TownId) => (id === 'schule' ? onOpenSchool() : onOpenTown(id));
  const starsOf = (id: TownId) =>
    TOWNS.find(t => t.id === id)?.scene.houses.reduce((n, h) => n + (h.game ? stickers[h.game]?.length ?? 0 : 0), 0) ?? 0;

  return (
    <div className="world-screen">
      <header className="world-header">
        <div>
          <h1 className="village-title world-title">Julia's Mathe-Dorf</h1>
          <div className="world-subtitle">🐼 für die Panda-Klasse 3b</div>
        </div>
        <div className="world-score">
          {currentAnimal(total).emoji}&nbsp;
          <Star size={14} fill="#f59e0b" stroke="none" style={{ verticalAlign: 'middle' }} />
          &nbsp;{total} Sticker
        </div>
        <button className="sound-btn" onClick={toggleSound} aria-label={sound ? 'Ton ausschalten' : 'Ton einschalten'} title={sound ? 'Ton aus' : 'Ton an'}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button className="reset-btn world-reset" onClick={onReset} aria-label="Spielstand zurücksetzen"><Trash2 size={14} /></button>
      </header>

      <main className="world-map" ref={frameRef}>
        {layout && (
          <IsoScene
            pieces={layout.pieces}
            maxScale={0.35}
            canvas
            onPick={at => {
              const t = layout.towns.find(t => { const [c, r] = at(t.h); return c >= t.c && c < t.c + t.size && r >= t.r && r < t.r + t.size; });
              if (t) open(t.id);
            }}
            overlay={place => (
              <>
                {layout.animals.filter(a => total >= a.threshold).map(a => {
                  const { left, top, scale } = place(a.c, a.r, a.z);
                  return <span key={a.emoji} className="iso-animal" style={{ left, top, fontSize: Math.max(14, 150 * scale) }}>{a.emoji}</span>;
                })}
                {layout.towns.map(t => {
                  // Fahne mit dem Zeichen der Stadt ueber der Stadtmitte — erkennbar,
                  // auch wenn die Stadt auf dem Handy klein ist.
                  const flag = place(t.c + t.size / 2 - 0.5, t.r + t.size / 2 - 0.5, t.h + 3.4);
                  // Gelbes Ortsschild neben der Strasse am Fuss der Rampe (Ortseingang)
                  const sign = place(t.foot[0] + 1, t.foot[1], 0);
                  const n = starsOf(t.id);
                  return (
                    <span key={t.id}>
                      <span className="town-flag" style={{ left: flag.left, top: flag.top }} aria-hidden="true">
                        <span className="town-flag-cloth">{ICONS[t.id]}</span>
                      </span>
                      <button className="ortsschild" style={{ left: sign.left, top: sign.top }} onClick={() => open(t.id)}>
                        <span className="ortsschild-board">
                          {NAMES[t.id]}
                          {n > 0 && <span className="ortsschild-stars"><Star size={10} fill="#f59e0b" stroke="none" />{n}</span>}
                        </span>
                        {t.id === 'schule' && exam && (
                          <span className="exam-flag">
                            📝 Arbeit am {formatDate(exam).slice(0, 6)}
                            <b>{days === 0 ? 'heute!' : days === 1 ? 'morgen!' : `noch ${days} Tage`}</b>
                          </span>
                        )}
                        <span className="ortsschild-post" />
                      </button>
                    </span>
                  );
                })}
              </>
            )}
          />
        )}
      </main>
    </div>
  );
};
