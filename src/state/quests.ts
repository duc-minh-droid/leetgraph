// One deterministic daily quest, seeded by the calendar date. Progress is
// derived from today's attempts — nothing stored.
import { getEnrichedAttempts, type EnrichedAttempt } from "./analytics";

export interface Quest {
  id: string;
  label: string;
  done: boolean;
}

interface QuestDef {
  id: string;
  label: string;
  test: (today: EnrichedAttempt[]) => boolean;
}

const POOL: QuestDef[] = [
  { id: "solve-1", label: "Clear any node", test: (t) => t.some((a) => a.solved) },
  {
    id: "solve-clean",
    label: "Solve without AI or hints",
    test: (t) => t.some((a) => a.solved && !a.ai && !a.hints),
  },
  {
    id: "solve-1300",
    label: "Beat a 1300+ elo problem",
    test: (t) => t.some((a) => a.solved && a.elo >= 1300),
  },
  {
    id: "attempt-2",
    label: "Log 2 attempts",
    test: (t) => t.length >= 2,
  },
  {
    id: "rematch-win",
    label: "Win a rematch (re-solve a past fail)",
    test: (t) => t.some((a) => a.solved && a.attemptsOnNode > 1),
  },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function questFor(day: string): QuestDef {
  return POOL[hash("quest:" + day) % POOL.length];
}

function attemptsOn(day: string, data: EnrichedAttempt[]): EnrichedAttempt[] {
  return data.filter((a) => dayKey(new Date(a.at)) === day);
}

export function todaysQuest(): Quest {
  const day = dayKey(new Date());
  const def = questFor(day);
  const data = getEnrichedAttempts();
  return { id: def.id, label: def.label, done: def.test(attemptsOn(day, data)) };
}

// How many daily quests were ever completed (replay per active day).
export function completedQuestCount(): number {
  const data = getEnrichedAttempts();
  const days = new Set(data.map((a) => dayKey(new Date(a.at))));
  let n = 0;
  for (const day of days) {
    if (questFor(day).test(attemptsOn(day, data))) n++;
  }
  return n;
}
