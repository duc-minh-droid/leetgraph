// Achievements + unlockable titles, all derived by replaying the attempt log.
import { getEnrichedAttempts, currentStreak, type EnrichedAttempt } from "./analytics";
import { peakRating } from "./rating";
import { completedQuestCount } from "./quests";
import { modifierOf, timedLimit } from "./modifiers";
import { listMaps, getMap } from "./library";
import { deriveNodeStatus } from "./nodeState";

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  title: string | null; // equippable title unlocked by this achievement
}

interface Ctx {
  attempts: EnrichedAttempt[];
  solves: EnrichedAttempt[];
  peak: number;
  streak: number;
  quests: number;
  rematchWins: number;
  actsCleared: number;
}

const DEFS: (AchievementDef & { test: (c: Ctx) => boolean })[] = [
  { id: "first-blood", name: "First Blood", desc: "Solve your first node.", title: "Initiate", test: (c) => c.solves.length >= 1 },
  { id: "grinder", name: "Grinder", desc: "Solve 10 nodes.", title: "Grinder", test: (c) => c.solves.length >= 10 },
  { id: "machine", name: "Machine", desc: "Solve 50 nodes.", title: "Machine", test: (c) => c.solves.length >= 50 },
  { id: "flawless", name: "Flawless", desc: "5 clean first-try solves.", title: "Flawless", test: (c) => c.solves.filter((a) => a.firstTry && !a.ai && !a.hints).length >= 5 },
  { id: "no-crutches", name: "No Crutches", desc: "10 solves without AI or hints.", title: "Purist", test: (c) => c.solves.filter((a) => !a.ai && !a.hints).length >= 10 },
  { id: "comeback", name: "Comeback Kid", desc: "Win a rematch — re-solve a node you failed.", title: "Comeback Kid", test: (c) => c.rematchWins >= 1 },
  { id: "redeemer", name: "Redeemer", desc: "Win 5 rematches.", title: "Redeemer", test: (c) => c.rematchWins >= 5 },
  { id: "streak-3", name: "Warming Up", desc: "3-day practice streak.", title: "Consistent", test: (c) => c.streak >= 3 },
  { id: "streak-7", name: "Relentless", desc: "7-day practice streak.", title: "Relentless", test: (c) => c.streak >= 7 },
  { id: "club-1200", name: "1200 Club", desc: "Reach 1200 rating.", title: "Climber", test: (c) => c.peak >= 1200 },
  { id: "club-1400", name: "1400 Club", desc: "Reach 1400 rating.", title: "Elo Climber", test: (c) => c.peak >= 1400 },
  { id: "club-1600", name: "1600 Club", desc: "Reach 1600 rating.", title: "Summit Seeker", test: (c) => c.peak >= 1600 },
  { id: "boss-slayer", name: "Boss Slayer", desc: "Clear an act's convergence node.", title: "Boss Slayer", test: (c) => c.actsCleared >= 1 },
  { id: "elite-hunter", name: "Elite Hunter", desc: "Solve an elite node.", title: "Elite Hunter", test: (c) => c.solves.some((a) => modifierOf(a.slug) === "elite") },
  { id: "speed-demon", name: "Speed Demon", desc: "Beat a timed node inside the limit.", title: "Speed Demon", test: (c) => c.solves.some((a) => modifierOf(a.slug) === "timed" && a.totalTime > 0 && a.totalTime <= timedLimit(a.difficulty)) },
  { id: "hard-boiled", name: "Hard Boiled", desc: "Solve a HARD problem.", title: "Masochist", test: (c) => c.solves.some((a) => a.difficulty === "HARD") },
  { id: "dutiful", name: "Dutiful", desc: "Complete 3 daily quests.", title: "Dutiful", test: (c) => c.quests >= 3 },
  { id: "interviewee", name: "Suit Up", desc: "Complete a mock interview.", title: "Interviewee", test: (c) => c.attempts.some((a) => a.note.startsWith("[Interview]")) },
];

export const ACHIEVEMENTS: AchievementDef[] = DEFS.map(({ id, name, desc, title }) => ({ id, name, desc, title }));

function buildCtx(): Ctx {
  const attempts = getEnrichedAttempts();
  const solves = attempts.filter((a) => a.solved);
  const lastFailed = new Map<string, boolean>();
  let rematchWins = 0;
  for (const a of attempts) {
    if (a.solved && lastFailed.get(a.slug)) rematchWins++;
    lastFailed.set(a.slug, !a.solved);
  }
  let actsCleared = 0;
  for (const meta of listMaps()) {
    const map = getMap(meta.id);
    const total = Math.max(...map.nodes.map((n) => n.act)) + 1;
    for (let act = 0; act < total; act++) {
      const inAct = map.nodes.filter((n) => n.act === act);
      const topRow = Math.max(...inAct.map((n) => n.row));
      const gateCleared = inAct.some((n) => {
        if (n.row !== topRow) return false;
        const st = deriveNodeStatus(n.slug);
        return st === "solved" || st === "solved_with_help";
      });
      if (gateCleared) actsCleared++;
    }
  }
  return {
    attempts,
    solves,
    peak: peakRating(),
    streak: currentStreak(),
    quests: completedQuestCount(),
    rematchWins,
    actsCleared,
  };
}

export function unlockedAchievements(): Set<string> {
  const ctx = buildCtx();
  return new Set(DEFS.filter((d) => d.test(ctx)).map((d) => d.id));
}

// ---- equipped title ----
const TITLE_KEY = "leetgraph.title";

export function unlockedTitles(): string[] {
  const unlocked = unlockedAchievements();
  return DEFS.filter((d) => d.title && unlocked.has(d.id)).map((d) => d.title!) ;
}

export function equippedTitle(): string {
  const stored = localStorage.getItem(TITLE_KEY);
  const titles = unlockedTitles();
  if (stored && titles.includes(stored)) return stored;
  return titles.length ? titles[titles.length - 1] : "Novice";
}

export function equipTitle(title: string) {
  localStorage.setItem(TITLE_KEY, title);
  window.dispatchEvent(
    new CustomEvent("leetgraph:persist", { detail: { kind: "profile", title } })
  );
}

// Cloud hydration setter — no persist emit.
export function setTitleLocal(title: string | null) {
  if (title) localStorage.setItem(TITLE_KEY, title);
  else localStorage.removeItem(TITLE_KEY);
}
