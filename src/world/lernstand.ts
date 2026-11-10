import type { Topic } from '../games/zr1000/tasks';

// "Das kann ich schon" — wie die Selbsteinschaetzung auf Julias Uebungsblatt,
// nur dass sie sich aus den eigenen Antworten fuellt. Gespeichert werden je
// Thema die letzten Ergebnisse (richtig beim ersten Versuch oder nicht).
export type TopicStats = Partial<Record<Topic, boolean[]>>;
export const KEEP = 10;

export const addResult = (stats: TopicStats, topic: Topic, ok: boolean): TopicStats =>
  ({ ...stats, [topic]: [...(stats[topic] ?? []), ok].slice(-KEEP) });

// 0 = noch nicht geuebt, 1 = noch unsicher, 2 = kann etwas, 3 = kann vieles, 4 = sicher
export const LEVEL_TEXT = ['Noch nicht geübt', 'Ich bin noch unsicher', 'Ich kann etwas', 'Ich kann vieles', 'Ich bin sicher'];

export const levelOf = (results: boolean[] = []): number => {
  if (results.length === 0) return 0;
  const share = results.filter(Boolean).length / results.length;
  const level = share >= 0.9 && results.length >= 5 ? 4 : share >= 0.7 ? 3 : share >= 0.4 ? 2 : 1;
  // Nach ein, zwei Aufgaben weiss man noch nicht viel.
  return results.length < 3 ? Math.min(level, 2) : level;
};
