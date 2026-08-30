// XP + levels: the volume/effort track. Rating is skill (can fall); XP only
// ever grows — every attempt pays something. XP is stamped onto attempts at
// submit time (relics can boost it) and replayed here.
import { getAllAttempts, type Attempt } from "./attempts";

// Legacy attempts (pre-XP) fall back to a base value.
export function xpOf(a: Attempt): number {
  if (typeof a.xp === "number") return a.xp;
  const solved = a.result === "solved" || a.result === "solved_with_help";
  return solved ? 25 : 10;
}

export function totalXp(): number {
  return Object.values(getAllAttempts())
    .flat()
    .reduce((s, a) => s + xpOf(a), 0);
}

// Cost to go from level n to n+1 grows linearly: 75, 100, 125, ...
export function costForLevel(n: number): number {
  return 75 + 25 * (n - 1);
}

export interface LevelInfo {
  level: number;
  xp: number; // total xp
  into: number; // xp earned inside the current level
  needed: number; // xp needed to reach the next level
  progress: number; // 0..1
}

export function levelInfo(xp = totalXp()): LevelInfo {
  let level = 1;
  let rest = xp;
  while (rest >= costForLevel(level)) {
    rest -= costForLevel(level);
    level++;
  }
  const needed = costForLevel(level);
  return { level, xp, into: rest, needed, progress: rest / needed };
}

export function currentLevel(): number {
  return levelInfo().level;
}
