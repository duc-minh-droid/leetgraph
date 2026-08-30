// Spaced-repetition "rematch" queue, derived from the last attempt per node.
//   failed             -> due in 1 day (3 days from the 2nd consecutive fail on)
//   solved with help   -> due in 7 days
//   solved using hints -> due in 14 days
//   clean solve        -> retired from the queue
import { getAllAttempts, type Attempt, type AttemptResult } from "./attempts";

const DAY = 86400000;

export interface ReviewItem {
  slug: string;
  dueAt: number;
  overdueDays: number;
  lastResult: AttemptResult;
  lastAt: number;
  attempts: number;
}

function isFail(a: Attempt): boolean {
  return a.result !== "solved" && a.result !== "solved_with_help";
}

function dueAtFor(attempts: Attempt[]): number | null {
  const last = attempts[attempts.length - 1];
  if (last.noRematch) return null; // Second Chance potion: fail is forgiven
  if (isFail(last)) {
    let failStreak = 0;
    for (let i = attempts.length - 1; i >= 0 && isFail(attempts[i]); i--) failStreak++;
    return last.at + (failStreak >= 2 ? 3 : 1) * DAY;
  }
  if (last.result === "solved_with_help") return last.at + 7 * DAY;
  if (last.hints || last.ai) return last.at + 14 * DAY;
  return null; // clean solve — retired
}

// Due (or overdue) rematches, optionally scoped to a set of slugs (a map).
export function dueReviews(scope?: Set<string>, now = Date.now()): ReviewItem[] {
  const log = getAllAttempts();
  const items: ReviewItem[] = [];
  for (const [slug, attempts] of Object.entries(log)) {
    if (!attempts.length || (scope && !scope.has(slug))) continue;
    const dueAt = dueAtFor(attempts);
    if (dueAt === null || dueAt > now) continue;
    const last = attempts[attempts.length - 1];
    items.push({
      slug,
      dueAt,
      overdueDays: Math.floor((now - dueAt) / DAY),
      lastResult: last.result,
      lastAt: last.at,
      attempts: attempts.length,
    });
  }
  return items.sort((a, b) => a.dueAt - b.dueAt);
}

export function dueSlugs(scope?: Set<string>): Set<string> {
  return new Set(dueReviews(scope).map((r) => r.slug));
}
