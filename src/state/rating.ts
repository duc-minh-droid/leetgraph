// Player Elo rating, derived by replaying the entire attempt log — never
// stored, so it can't drift from history. Chess-style updates against each
// problem's Elo.
import { getEnrichedAttempts, type EnrichedAttempt } from "./analytics";
import { modifierOf, timedLimit } from "./modifiers";

export const START_RATING = 1000;
const K = 32;

export interface RatingPoint {
  i: number; // 1-based attempt index
  rating: number;
  delta: number;
  at: number;
  title: string;
  probElo: number;
  solved: boolean;
  rematchWin: boolean;
}

function scoreOf(a: EnrichedAttempt): number {
  if (!a.solved) return 0;
  if (a.result === "solved_with_help") return 0.5;
  return a.firstTry && !a.ai && !a.hints ? 1 : 0.85;
}

// K multiplier from node modifiers + rematch bonus.
function kMultiplier(a: EnrichedAttempt, rematchWin: boolean): number {
  let m = 1;
  const mod = modifierOf(a.slug);
  if (mod === "elite") m *= 1.5;
  if (mod === "timed" && a.solved && a.totalTime > 0 && a.totalTime <= timedLimit(a.difficulty)) m *= 1.25;
  if (mod === "purist" && a.solved && !a.ai && !a.hints) m *= 1.25;
  if (rematchWin) m *= 1.25;
  return m;
}

export function ratingHistory(attempts?: EnrichedAttempt[]): RatingPoint[] {
  const data = attempts ?? getEnrichedAttempts();
  let rating = START_RATING;
  const lastFailed = new Map<string, boolean>();
  return data.map((a, i) => {
    const rematchWin = a.solved && lastFailed.get(a.slug) === true;
    const expected = 1 / (1 + Math.pow(10, (a.elo - rating) / 400));
    // Relic/curse/event effects were rolled at submit time and stamped on the
    // attempt — apply them here so history replays identically forever.
    const delta =
      Math.round(K * kMultiplier(a, rematchWin) * (scoreOf(a) - expected) * a.ratingBonusMult) +
      a.ratingBonusFlat;
    rating = Math.max(100, rating + delta);
    lastFailed.set(a.slug, !a.solved);
    return {
      i: i + 1,
      rating,
      delta,
      at: a.at,
      title: a.title,
      probElo: a.elo,
      solved: a.solved,
      rematchWin,
    };
  });
}

export function currentRating(): number {
  const h = ratingHistory();
  return h.length ? h[h.length - 1].rating : START_RATING;
}

export function peakRating(): number {
  return ratingHistory().reduce((m, p) => Math.max(m, p.rating), START_RATING);
}
