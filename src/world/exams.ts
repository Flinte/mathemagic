import type { GameId } from './games';
import type { Topic } from '../games/zr1000/tasks';

// Die Lernzettel der Klassenarbeiten, Wort fuer Wort wie von der Lehrerin.
// Fuer eine neue Arbeit genuegt ein neuer Eintrag oben in der Liste — die
// Schule zeigt immer die naechste anstehende Arbeit, die anderen klappen weg.
export interface ExamTopic {
  text: string;
  games: GameId[];
  // Welche Aufgaben-Themen dazu zaehlen — daraus fuellt sich "Das kann ich schon".
  topics?: Topic[];
}

export interface Exam {
  date: string;   // JJJJ-MM-TT
  topics: ExamTopic[];
}

export const EXAMS: Exam[] = [
  {
    date: '2026-11-17',
    topics: [
      { text: 'Zahlen in der Stellenwertschreibweise erkennen, Geheimschrift', games: ['stellenwert'], topics: ['stellenwert'] },
      { text: 'Plättchen in der Stellenwerttafel', games: ['stellenwert'], topics: ['plaettchen'] },
      { text: 'Ausschnitte aus dem Tausenderstreifen', games: ['tausender-streifen'], topics: ['streifen'] },
      { text: 'Zahlenfolgen, Zahlwörter', games: ['tausender-streifen', 'stellenwert'], topics: ['folgen', 'zahlwort'] },
      { text: 'Zahlenstrahl', games: ['zahlenstrahl'], topics: ['strahl'] },
      { text: 'Nachfolger, Vorgänger', games: ['tausender-streifen'], topics: ['nachfolger'] },
      { text: 'Nachbarzehner, Nachbarhunderter', games: ['runden'], topics: ['nachbarn'] },
      { text: 'Runden auf Zehner, auf Hunderter', games: ['runden'], topics: ['runden'] },
      { text: 'Geld (auch die Kommaschreibweise), Sachaufgaben', games: ['geld', 'sachaufgaben'], topics: ['geld'] },
    ],
  },
  {
    date: '2026-09-28',
    topics: [
      { text: 'Addition, Subtraktion im Zahlenraum 100', games: ['plus', 'minus', 'zahlen-mauer'] },
      { text: 'Multiplikation (kleines Einmaleins), Division', games: ['einmaleins-gross', 'division'] },
      { text: 'Division mit Rest', games: ['division-rest'] },
      { text: 'Sachaufgaben', games: ['sachaufgaben'] },
      { text: 'Quadratzahlen', games: ['einmaleins-tafel'] },
      { text: 'Punkt-vor-Strich-Aufgaben', games: ['punkt-vor-strich'] },
      { text: 'Zeit: volle und halbe Stunden, Minuten, Zeitspannen', games: ['uhrzeit'] },
    ],
  },
  {
    date: '2026-08-25',
    topics: [
      { text: 'Tausch- und Umkehraufgaben beim Malnehmen', games: ['tausch-arena', 'division-zerlegen'] },
      { text: 'Kernaufgaben ×1, ×2, ×5, ×10', games: ['kernaufgaben'] },
      { text: 'Einmaleins-Reihen, Mal- und Geteiltaufgaben', games: ['einmaleins-klein', 'einmaleins-gross', 'division'] },
      { text: 'Zahlenrätsel', games: ['platzhalter'] },
    ],
  },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Tage bis zur Arbeit; 0 = heute, negativ = vorbei.
export const daysUntil = (exam: Exam, now = new Date()) => {
  const [y, m, d] = exam.date.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(now).getTime()) / 86_400_000);
};

// Die naechste Arbeit, die noch nicht vorbei ist — oder keine.
export const nextExam = (now = new Date()) =>
  [...EXAMS].filter(e => daysUntil(e, now) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];

export const formatDate = (exam: Exam) => {
  const [y, m, d] = exam.date.split('-');
  return `${d}.${m}.${y}`;
};
