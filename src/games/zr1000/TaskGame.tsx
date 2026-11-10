import { useEffect, useRef, useState } from 'react';
import { GameHeader, StarProgress } from '../GameChrome';
import { drawFresh, pick, playSound, STICKERS } from '../shared';
import { GAMES } from '../../world/games';
import { NumInput, type NumInputHandle } from '../../ui/NumInput';
import { PlaceTable } from './visuals';
import { EXAM_PLAN, GAME_TASKS, TOPIC_LABEL, isRight, type Task, type TaskGameId, type Topic } from './tasks';

type Mode = 'practice' | 'exam';
type Phase = 'ask' | 'right' | 'reveal';

// ── Eine Aufgabe ──
// Ueben: zwei Versuche. Nach dem ersten Fehler bleiben die falschen Zahlen rot
// stehen und der Tipp erscheint; nach dem zweiten steht die Loesung in den
// Feldern. Mit "Hilfe" kommt man jederzeit an Tipp und Loesung.
// Probearbeit: ein Versuch, keine Hilfe — wie in der echten Arbeit.
type Mark = '' | 'right' | 'wrong' | 'missing';

const TaskCard = ({ task, mode, onDone }: { task: Task; mode: Mode; onDone: (right: boolean) => void }) => {
  const n = task.answers?.length ?? 0;
  const [vals, setVals] = useState<string[]>(() => Array(n).fill(''));
  const [marks, setMarks] = useState<Mark[]>(() => Array(n).fill(''));
  const [tries, setTries] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [showHint, setShowHint] = useState(false);
  const [missing, setMissing] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);         // Auswahl bzw. Reihenfolge
  const [counts, setCounts] = useState<[number, number, number]>([0, 0, 0]);
  const [shake, setShake] = useState(-1);
  const refs = useRef<(NumInputHandle | null)[]>([]);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const practice = mode === 'practice';

  const right = () => {
    playSound('correct');
    setPhase('right');
    timer.current = window.setTimeout(() => onDone(true), 900);
  };
  const reveal = () => {
    setPhase('reveal');
    if (task.build !== undefined) setCounts([Math.floor(task.build / 100), Math.floor(task.build / 10) % 10, task.build % 10]);
  };
  // Ein Fehlversuch. Gibt true zurueck, wenn danach aufgeloest wird.
  const wrong = () => {
    playSound('wrong');
    const t = tries + 1;
    setTries(t);
    if (!practice || t >= 2) { reveal(); return true; }
    setShowHint(true);
    return false;
  };

  // ── Zahlenfelder ──
  const submit = () => {
    if (phase === 'reveal') { onDone(false); return; }
    if (phase !== 'ask' || !task.answers) return;
    const empty = vals.map((v, i) => v === '' && marks[i] !== 'right');
    if (empty.some(Boolean)) {
      setMissing(true);
      setMarks(m => m.map((x, i) => (empty[i] ? 'missing' : x)));
      refs.current[empty.indexOf(true)]?.focus();
      return;
    }
    setMissing(false);
    const ok = task.answers.map((a, i) => isRight(vals[i], a, task.comma));
    setMarks(ok.map(o => (o ? 'right' : 'wrong')));
    if (ok.every(Boolean)) { right(); return; }
    if (!wrong()) refs.current[ok.indexOf(false)]?.focus();
  };

  // Tippen in ein rotes Feld ersetzt die falsche Zahl, statt sie zu verlaengern.
  const type = (i: number, v: string) => {
    const was = vals[i];
    const next = marks[i] === 'wrong' ? (v.length > was.length ? v.slice(was.length) : '') : v;
    setVals(p => p.map((x, j) => (j === i ? next : x)));
    setMarks(p => p.map((x, j) => (j === i && (x === 'wrong' || x === 'missing') ? '' : x)));
  };

  const slot = (i: number) => {
    const solved = phase === 'reveal' && marks[i] !== 'right';
    return (
      <NumInput
        ref={el => { refs.current[i] = el; }}
        value={solved ? task.answers![i] : vals[i]}
        onChange={v => type(i, v)}
        onSubmit={submit}
        readOnly={phase !== 'ask' || marks[i] === 'right'}
        autoFocus={i === 0}
        allowComma={task.comma}
        maxLength={task.comma ? 6 : 4}
        className={`tk-input ${solved ? 'solution' : marks[i]}`}
      />
    );
  };

  // ── Auswahl ──
  const choose = (i: number) => {
    if (phase !== 'ask' || !task.choice || picked.includes(i)) return;
    if (i === task.choice.correct) { setPicked([i]); right(); return; }
    setPicked(p => [...p, i]);
    wrong();
  };

  // ── Ordnen ──
  const sorted = task.order ? [...task.order].sort((a, b) => a - b) : [];
  const tapOrder = (v: number) => {
    if (phase !== 'ask' || picked.includes(v)) return;
    if (v === sorted[picked.length]) {
      const next = [...picked, v];
      setPicked(next);
      if (next.length === sorted.length) right();
      return;
    }
    setShake(v);
    timer.current = window.setTimeout(() => setShake(-1), 500);
    wrong();
  };

  // ── Plaettchen legen ──
  const checkBuild = () => {
    if (phase !== 'ask' || task.build === undefined) return;
    if (counts[0] * 100 + counts[1] * 10 + counts[2] === task.build) right();
    else wrong();
  };

  // Hilfe-Knopf: erst der Tipp, dann die Loesung
  const help = () => { if (!showHint) setShowHint(true); else reveal(); };

  return (
    <div className="tk-card">
      <p className="tk-prompt">{task.prompt}</p>
      {task.view && <div className="tk-view">{task.view(slot)}</div>}

      {task.choice && (
        <div className="tk-choices">
          {task.choice.options.map((o, i) => {
            const state = phase !== 'ask' && i === task.choice!.correct ? 'right' : picked.includes(i) ? (i === task.choice!.correct ? 'right' : 'wrong') : '';
            return <button key={o} className={`tk-choice ${state}`} onClick={() => choose(i)}>{o}</button>;
          })}
        </div>
      )}

      {task.order && (
        <div className="tk-order">
          {task.order.map(v => {
            const pos = phase === 'reveal' ? sorted.indexOf(v) : picked.indexOf(v);
            return (
              <button key={v} className={`tk-order-num ${pos >= 0 ? 'done' : ''} ${shake === v ? 'shake' : ''}`} onClick={() => tapOrder(v)}>
                {pos >= 0 && <span className="tk-order-pos">{pos + 1}.</span>}{v}
              </button>
            );
          })}
        </div>
      )}

      {task.build !== undefined && (
        <>
          <PlaceTable counts={counts} onChange={phase === 'ask' ? setCounts : undefined} />
          {phase === 'ask' && <button className="tk-next" onClick={checkBuild}>Fertig ✓</button>}
        </>
      )}

      <div className="tk-feedback-area">
        {phase === 'right' && <div className="tk-feedback right">Richtig! 🎉</div>}
        {phase === 'ask' && missing && <div className="tk-feedback hint">Es fehlt noch eine Zahl. ✏️</div>}
        {phase === 'ask' && !missing && tries === 1 && <div className="tk-feedback hint">Nicht ganz — {n > 0 ? 'die roten Zahlen stimmen noch nicht.' : 'versuch es noch einmal.'}</div>}
        {phase === 'ask' && showHint && <div className="tk-feedback tip">💡 {task.hint}</div>}
        {phase === 'reveal' && (
          <div className="tk-feedback wrong">
            <span>So ist es richtig: <b>{task.solution}</b></span>
            {practice && <span className="tk-tip-small">💡 {task.hint}</span>}
            <button className="tk-next" onClick={() => onDone(false)}>Weiter →</button>
          </div>
        )}
        {phase === 'ask' && practice && (
          <button className="tk-help" onClick={help}>{showHint ? '👀 Lösung zeigen' : '💡 Hilfe'}</button>
        )}
      </div>
    </div>
  );
};

// ── Ueben in einem Haus ──
const ROUND = 6;

export const TaskGame = ({ game, onWin, onBack }: { game: TaskGameId; onWin: (s: string) => void; onBack: () => void }) => {
  const roll = () => drawFresh(game, 8, () => pick(GAME_TASKS[game])(), t => t.id);
  const [task, setTask] = useState<Task>(roll);
  const [count, setCount] = useState(0);     // Nummer der Aufgabe — erneuert die Karte
  const [solved, setSolved] = useState(0);

  const done = (ok: boolean) => {
    const s = solved + (ok ? 1 : 0);
    setSolved(s);
    if (s >= ROUND) { onWin(pick(STICKERS)); return; }
    setTask(roll());
    setCount(c => c + 1);
  };

  return (
    <div className="game-page" style={{ background: `linear-gradient(160deg, ${GAMES[game].color}28 0%, #f5f8ff 100%)` }}>
      <GameHeader category={game} onBack={onBack} />
      <div className="game-container tk-container">
        <StarProgress solved={solved} total={ROUND} />
        <TaskCard key={count} task={task} mode="practice" onDone={done} />
      </div>
    </div>
  );
};

// ── Probearbeit ──
// Wo man ein Thema ueben kann, wenn es in der Probearbeit nicht geklappt hat.
const PRACTICE_IN: Record<Topic, TaskGameId> = {
  stellenwert: 'stellenwert', plaettchen: 'stellenwert', zahlwort: 'stellenwert',
  streifen: 'tausender-streifen', folgen: 'tausender-streifen', nachfolger: 'tausender-streifen', ordnen: 'tausender-streifen',
  strahl: 'zahlenstrahl', nachbarn: 'runden', runden: 'runden', geld: 'geld',
};

export const Probearbeit = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [tasks] = useState(() => EXAM_PLAN.map(gens => pick(gens)()));
  const [results, setResults] = useState<boolean[]>([]);
  const i = results.length;

  if (i >= tasks.length) {
    const score = results.filter(Boolean).length;
    const missed = [...new Set(tasks.filter((_, k) => !results[k]).map(t => t.topic))];
    return (
      <div className="game-page" style={{ background: 'linear-gradient(160deg, #c6282828 0%, #fff8f8 100%)' }}>
        <GameHeader category="probearbeit" onBack={onBack} />
        <div className="game-container tk-container">
          <div className="tk-card exam-result">
            <h2>{score} von {tasks.length} richtig {score === tasks.length ? '🏆' : score >= tasks.length * 0.75 ? '🌟' : '💪'}</h2>
            <ul className="exam-list">
              {tasks.map((t, k) => (
                <li key={k} className={results[k] ? 'right' : 'wrong'}>{results[k] ? '✓' : '✗'} {TOPIC_LABEL[t.topic]}</li>
              ))}
            </ul>
            {missed.length > 0 && (
              <p className="exam-tip">
                Noch üben: {[...new Set(missed.map(t => GAMES[PRACTICE_IN[t]].label))].join(', ')}
              </p>
            )}
            <button className="tk-next" onClick={() => onWin('📝')}>Sticker abholen 📝</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #c6282828 0%, #fff8f8 100%)' }}>
      <GameHeader category="probearbeit" onBack={onBack} />
      <div className="game-container tk-container">
        <div className="exam-progress">Aufgabe {i + 1} von {tasks.length}</div>
        <TaskCard key={i} task={tasks[i]} mode="exam" onDone={ok => setResults(r => [...r, ok])} />
      </div>
    </div>
  );
};
