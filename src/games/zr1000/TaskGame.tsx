import { useEffect, useRef, useState } from 'react';
import { GameHeader, StarProgress } from '../GameChrome';
import { drawFresh, pick, playSound, STICKERS } from '../shared';
import { GAMES } from '../../world/games';
import { NumInput, type NumInputHandle } from '../../ui/NumInput';
import { keypad } from '../../ui/keypadStore';
import { PandaStamp, PandaTip, TeacherCheck, TeacherCross } from '../../ui/Panda';
import { PlaceTable } from './visuals';
import { EXAM_PLAN, GAME_TASKS, isRight, type Task, type TaskGameId, type Topic } from './tasks';

// Meldet nach jeder Aufgabe, ob sie beim ersten Versuch geklappt hat — daraus
// waechst der Lernstand je Thema in der Schule.
export type OnResult = (topic: Topic, firstTry: boolean) => void;

type Phase = 'ask' | 'right' | 'reveal';
type Mark = '' | 'right' | 'wrong' | 'missing';
type Status = 'empty' | 'right' | 'wrong';

const digitsOf = (n: number): [number, number, number] => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];

// ── Eine Aufgabe auf Rechenpapier ──
// practice: zwei Versuche, danach steht die Loesung in den Feldern. Mit
//   "Hilfe" kommt man jederzeit an Tipp und Loesung.
// sheet: Teil der Probearbeit — nichts wird geprueft, bis das Blatt
//   abgegeben ist (`graded`); dann korrigiert die "Lehrerin" in Lila.
interface CardProps {
  task: Task;
  mode: 'practice' | 'sheet';
  onDone?: (right: boolean, firstTry: boolean) => void;   // practice
  graded?: boolean;                                          // sheet
  onStatus?: (s: Status) => void;                            // sheet
  number?: number;                                           // sheet: Aufgabennummer
}

const TaskCard = ({ task, mode, onDone, graded = false, onStatus, number }: CardProps) => {
  const n = task.answers?.length ?? 0;
  const sheet = mode === 'sheet';
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

  const sorted = task.order ? [...task.order].sort((a, b) => a - b) : [];

  // ── Stand der Aufgabe (fuer das Blatt) ──
  const status = (): Status => {
    if (task.answers) {
      if (vals.some(v => v === '')) return vals.every(v => v === '') ? 'empty' : 'wrong';
      return task.answers.every((a, i) => isRight(vals[i], a, task.comma)) ? 'right' : 'wrong';
    }
    if (task.choice) return picked.length === 0 ? 'empty' : picked[0] === task.choice.correct ? 'right' : 'wrong';
    if (task.order) return picked.length === 0 ? 'empty' : picked.every((v, i) => v === sorted[i]) && picked.length === sorted.length ? 'right' : 'wrong';
    if (task.build !== undefined) return counts.every(c => c === 0) ? 'empty' : counts[0] * 100 + counts[1] * 10 + counts[2] === task.build ? 'right' : 'wrong';
    return 'empty';
  };
  const current = status();
  useEffect(() => { onStatus?.(current); }, [current, onStatus]);
  const locked = sheet ? graded : phase !== 'ask';

  // ── Ueben: richtig, falsch, aufloesen ──
  const right = () => {
    playSound('correct');
    setPhase('right');
    const first = tries === 0 && !showHint;
    timer.current = window.setTimeout(() => onDone?.(true, first), 1000);
  };
  const reveal = () => {
    setPhase('reveal');
    if (task.build !== undefined) setCounts(digitsOf(task.build));
  };
  const wrong = () => {
    playSound('wrong');
    const t = tries + 1;
    setTries(t);
    if (t >= 2) { reveal(); return true; }
    setShowHint(true);
    return false;
  };
  const next = () => onDone?.(false, false);

  // ── Zahlenfelder ──
  // Beim Ueben muss man nie bestaetigen: eine richtige Zahl wird sofort
  // erkannt, und sobald alle Felder "fertig getippt" sind, wertet die Aufgabe
  // sich selbst aus. ✓ prueft nur vorzeitig bzw. heisst nach dem Aufloesen "weiter".
  const evaluate = (vs: string[]) => {
    const ok = task.answers!.map((a, i) => isRight(vs[i], a, task.comma));
    setMissing(false);
    setMarks(ok.map(o => (o ? 'right' : 'wrong')));
    if (ok.every(Boolean)) { right(); return; }
    if (!wrong()) refs.current[ok.indexOf(false)]?.focus();
  };

  const submit = () => {
    if (sheet) { keypad.focusNext(); return; }
    if (phase === 'reveal') { next(); return; }
    if (phase !== 'ask' || !task.answers) return;
    const empty = vals.map((v, i) => v === '' && marks[i] !== 'right');
    if (empty.some(Boolean)) {
      setMissing(true);
      setMarks(m => m.map((x, i) => (empty[i] ? 'missing' : x)));
      refs.current[empty.indexOf(true)]?.focus();
      return;
    }
    evaluate(vals);
  };

  // Hat das Kind so viele Ziffern getippt wie die Loesung hat? Fuehrende
  // Nullen zaehlen nicht ("05" fuer 5 ct), bei Euro zaehlen die zwei Cent-Stellen.
  const complete = (v: string, a: string) => task.comma
    ? v.includes(',') && v.split(',')[1].length >= 2
    : v !== '' && v !== '0' && String(Number(v)).length >= a.length;

  // Tippen in ein rotes Feld ersetzt die falsche Zahl, statt sie zu verlaengern.
  const type = (i: number, v: string) => {
    const was = vals[i];
    const nv = marks[i] === 'wrong' ? (v.length > was.length ? v.slice(was.length) : '') : v;
    const vs = vals.map((x, j) => (j === i ? nv : x));
    const a = task.answers?.[i] ?? '';
    const nowRight = !sheet && phase === 'ask' && !!task.answers && isRight(nv, a, task.comma);
    // Richtig wird sofort gruen; ein rotes oder gelbes Feld wird beim Tippen wieder neutral.
    const ms: Mark[] = marks.map((x, j) => (j !== i ? x : nowRight ? 'right' : x === 'wrong' || x === 'missing' ? '' : x));
    setVals(vs);
    setMarks(ms);
    if (sheet || phase !== 'ask' || !task.answers) return;

    if (nowRight) {
      // Weiter zum naechsten offenen Feld — oder fertig.
      const open = ms.findIndex(m => m !== 'right');
      if (open < 0) { evaluate(vs); return; }
      const nextEmpty = vs.findIndex((x, j) => ms[j] !== 'right' && x === '');
      refs.current[nextEmpty >= 0 ? nextEmpty : open]?.focus();
      return;
    }
    if (!complete(nv, a)) return;
    // Fertig getippt, aber falsch: Ist noch ein Feld leer, geht es dort weiter;
    // sonst wird die ganze Aufgabe ausgewertet.
    const nextEmpty = vs.findIndex((x, j) => ms[j] !== 'right' && x === '');
    if (nextEmpty >= 0) refs.current[nextEmpty]?.focus();
    else evaluate(vs);
  };

  const slot = (i: number) => {
    // Ueben: nach dem Aufloesen steht die Loesung im Feld.
    const solved = !sheet && phase === 'reveal' && marks[i] !== 'right';
    // Blatt: nach der Abgabe wird falsch unterstrichen und daneben verbessert.
    const gradedWrong = sheet && graded && !isRight(vals[i], task.answers![i], task.comma);
    const mark = sheet ? (graded ? (gradedWrong ? 'wrong' : 'right') : '') : solved ? 'solution' : marks[i];
    // Abgegebenes Blatt: nur noch Text, kein Eingabefeld — sonst bliebe der
    // Ziffernblock stehen, obwohl nichts mehr einzutragen ist.
    if (sheet && graded) {
      return (
        <span className="tk-slot">
          <span className={`num-input tk-input ${mark}`}>
            {vals[i] === '' ? <span className="num-box empty" /> : [...vals[i]].map((ch, k) => <span key={k} className={`num-box ${ch === ',' ? 'comma' : ''}`}>{ch}</span>)}
          </span>
          {gradedWrong && <span className="tk-correction">{task.answers![i]}</span>}
        </span>
      );
    }
    return (
      <span className="tk-slot">
        <NumInput
          ref={el => { refs.current[i] = el; }}
          value={solved ? task.answers![i] : vals[i]}
          onChange={v => type(i, v)}
          onSubmit={submit}
          readOnly={locked || marks[i] === 'right'}
          autoFocus={!sheet && i === 0}
          allowComma={task.comma}
          maxLength={task.comma ? 6 : 4}
          boxes
          className={`tk-input ${mark}`}
        />
        {gradedWrong && <span className="tk-correction">{task.answers![i]}</span>}
      </span>
    );
  };

  // ── Auswahl ──
  const choose = (i: number) => {
    if (locked || !task.choice) return;
    if (sheet) { setPicked([i]); return; }
    if (picked.includes(i)) return;
    if (i === task.choice.correct) { setPicked([i]); right(); return; }
    setPicked(p => [...p, i]);
    wrong();
  };

  // ── Ordnen ──
  const tapOrder = (v: number) => {
    if (locked) return;
    if (sheet) {
      // Auf dem Blatt darf man umentscheiden: nochmal antippen nimmt die Zahl
      // und alle danach wieder weg.
      const at = picked.indexOf(v);
      setPicked(at >= 0 ? picked.slice(0, at) : [...picked, v]);
      return;
    }
    if (picked.includes(v)) return;
    if (v === sorted[picked.length]) {
      const nx = [...picked, v];
      setPicked(nx);
      if (nx.length === sorted.length) right();
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

  const help = () => { if (!showHint) setShowHint(true); else reveal(); };
  const showMarks = sheet ? graded : phase !== 'ask';

  return (
    <div className={`tk-card heft ${sheet ? 'sheet' : ''}`}>
      <div className="tk-head">
        {number !== undefined && <span className="tk-number">{number}</span>}
        <p className="tk-prompt">{task.prompt}</p>
        {sheet && graded && (current === 'right' ? <TeacherCheck /> : <TeacherCross />)}
        {!sheet && phase === 'right' && <TeacherCheck size={44} />}
      </div>

      {task.view && <div className="tk-view">{task.view(slot)}</div>}

      {task.choice && (
        <div className="tk-choices">
          {task.choice.options.map((o, i) => {
            const isPicked = picked.includes(i);
            const state = showMarks && i === task.choice!.correct && (!sheet || isPicked || graded) ? 'right'
              : isPicked ? (showMarks || !sheet ? (i === task.choice!.correct ? 'right' : 'wrong') : 'picked') : '';
            return <button key={o} className={`tk-choice ${state}`} onClick={() => choose(i)}>{o}</button>;
          })}
        </div>
      )}

      {task.order && (
        <div className="tk-order">
          {task.order.map(v => {
            const pos = !sheet && phase === 'reveal' ? sorted.indexOf(v) : picked.indexOf(v);
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
          <PlaceTable counts={counts} onChange={locked ? undefined : setCounts} />
          {!sheet && phase === 'ask' && <button className="tk-next" onClick={checkBuild}>Fertig ✓</button>}
        </>
      )}

      {sheet && graded && current !== 'right' && <p className="tk-teacher-note">Richtig: {task.solution}</p>}

      {!sheet && (
        <div className="tk-feedback-area">
          {phase === 'right' && <div className="tk-feedback right">Richtig! 🎉</div>}
          {phase === 'ask' && missing && <div className="tk-feedback hint">Es fehlt noch eine Zahl. ✏️</div>}
          {phase === 'ask' && !missing && tries === 1 && <div className="tk-feedback hint">Nicht ganz — {n > 0 ? 'die unterstrichenen Zahlen stimmen noch nicht.' : 'versuch es noch einmal.'}</div>}
          {phase === 'ask' && showHint && <PandaTip>{task.hint}</PandaTip>}
          {phase === 'reveal' && (
            <div className="tk-feedback reveal">
              <span>So ist es richtig: <b>{task.solution}</b></span>
              <PandaTip>{task.hint}</PandaTip>
              <button className="tk-next" onClick={next}>Weiter →</button>
            </div>
          )}
          {phase === 'ask' && <button className="tk-help" onClick={help}>{showHint ? '👀 Lösung zeigen' : '💡 Hilfe'}</button>}
        </div>
      )}
    </div>
  );
};

// ── Ueben in einem Haus ──
const ROUND = 6;

export const TaskGame = ({ game, onWin, onBack, onResult }: { game: TaskGameId; onWin: (s: string) => void; onBack: () => void; onResult?: OnResult }) => {
  const roll = () => drawFresh(game, 8, () => pick(GAME_TASKS[game])(), t => t.id);
  const [task, setTask] = useState<Task>(roll);
  const [count, setCount] = useState(0);     // Nummer der Aufgabe — erneuert die Karte
  const [solved, setSolved] = useState(0);

  const done = (ok: boolean, firstTry: boolean) => {
    onResult?.(task.topic, firstTry);
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

// ── Probearbeit: ein ganzes Blatt ──
// Wo man ein Thema ueben kann, wenn es in der Probearbeit nicht geklappt hat.
const PRACTICE_IN: Record<Topic, TaskGameId> = {
  stellenwert: 'stellenwert', plaettchen: 'stellenwert', zahlwort: 'stellenwert',
  streifen: 'tausender-streifen', folgen: 'tausender-streifen', nachfolger: 'tausender-streifen', ordnen: 'tausender-streifen',
  strahl: 'zahlenstrahl', nachbarn: 'runden', runden: 'runden', geld: 'geld',
};

const today = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

const verdict = (score: number, total: number) =>
  score === total ? 'Toll, 0 Fehler!' : score >= total * 0.85 ? 'Super!' : score >= total * 0.6 ? 'Gut gemacht!' : 'Weiter üben!';

export const Probearbeit = ({ onWin, onBack, onResult }: { onWin: (s: string) => void; onBack: () => void; onResult?: OnResult }) => {
  const [tasks] = useState(() => EXAM_PLAN.map(gens => pick(gens)()));
  const [statuses, setStatuses] = useState<Status[]>(() => tasks.map(() => 'empty'));
  const [graded, setGraded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Pro Aufgabe ein stabiler Rueckruf, sonst meldet jede Karte bei jedem Zeichnen neu.
  const [setters] = useState(() => tasks.map((_, k) => (s: Status) => setStatuses(p => (p[k] === s ? p : p.map((x, j) => (j === k ? s : x))))));

  const open = statuses.filter(s => s === 'empty').length;
  const score = statuses.filter(s => s === 'right').length;

  const hand = () => {
    if (open > 0 && !confirm) { setConfirm(true); return; }
    setGraded(true);
    tasks.forEach((t, k) => onResult?.(t.topic, statuses[k] === 'right'));
    playSound(score >= tasks.length * 0.6 ? 'correct' : 'wrong');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const missed = [...new Set(tasks.filter((_, k) => statuses[k] !== 'right').map(t => GAMES[PRACTICE_IN[t.topic]].label))];

  return (
    <div className="game-page exam-page">
      <GameHeader category="probearbeit" onBack={onBack} />
      <div className="exam-sheet">
        <div className="exam-sheet-head">
          <span>Name: <span className="handwriting">Julia</span></span>
          <span>Datum: <span className="handwriting">{today()}</span></span>
          <span className="exam-code">PA</span>
        </div>
        <h2 className="exam-title">Probearbeit · Zahlenraum bis 1000</h2>

        {graded && (
          <div className="exam-grade">
            <PandaStamp text={verdict(score, tasks.length)} />
            <div>
              <div className="exam-score">{score} von {tasks.length} richtig</div>
              {missed.length > 0 && <div className="exam-tip">Noch üben: {missed.join(', ')}</div>}
            </div>
          </div>
        )}

        {tasks.map((t, k) => (
          <TaskCard key={k} task={t} mode="sheet" number={k + 1} graded={graded} onStatus={setters[k]} />
        ))}

        <div className="exam-foot">
          {!graded && confirm && open > 0 && (
            <p className="exam-confirm">Noch {open} {open === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} leer. Trotzdem abgeben?</p>
          )}
          {!graded
            ? <button className="tk-next exam-hand-in" onClick={hand}>{confirm && open > 0 ? 'Ja, abgeben' : 'Abgeben ✓'}</button>
            : <button className="tk-next" onClick={() => onWin('📝')}>Sticker abholen 📝</button>}
        </div>
      </div>
    </div>
  );
};
