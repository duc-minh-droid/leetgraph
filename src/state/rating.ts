// Player rating engine v2 — still a pure replay of the attempt log, but the
// number now lives inside a competitive frame:
//
//   RANKS    named tiers (Bronze → Grandmaster) with promotion/demotion
//   PROMOS   crossing a rank threshold arms a series: win 2 of the next 3
//            attempts to seal the promotion; lose it and pay 10 rating
//   DECAY    3 idle days of grace, then −5/day, floored at your rank's bottom
//            (your streak literally defends your rating)
//   SEASONS  each calendar month soft-resets rating toward 1000; the season
//            peak is immortalized
//   CUTOFF   solving a problem ≥150 below your rating earns nothing — the only
//            way up is to fight at or above your level
import { getEnrichedAttempts, type EnrichedAttempt } from "./analytics";
import { modifierOf, timedLimit } from "./modifiers";

export const START_RATING = 1000;
const K = 32;
const DECAY_GRACE_DAYS = 3;
const DECAY_PER_DAY = 5;
const FARM_CUTOFF = 150;
const PROMO_WINS_NEEDED = 2;
const PROMO_LOSSES_ALLOWED = 1;
const PROMO_FAIL_PENALTY = 10;
const DEMOTION_GRACE = 25;
const DAY = 86400000;

export interface Rank {
  id: string;
  name: string;
  min: number;
  color: string; // chip background
  text: string; // chip text color
}

export const RANKS: Rank[] = [
  { id: "bronze", name: "Bronze", min: 0, color: "#b87333", text: "#000000" },
  { id: "silver", name: "Silver", min: 1100, color: "#c9cbcf", text: "#000000" },
  { id: "gold", name: "Gold", min: 1250, color: "#FFD93D", text: "#000000" },
  { id: "platinum", name: "Platinum", min: 1400, color: "#7fdbca", text: "#000000" },
  { id: "diamond", name: "Diamond", min: 1550, color: "#74c0fc", text: "#000000" },
  { id: "master", name: "Master", min: 1700, color: "#C4B5FD", text: "#000000" },
  { id: "grandmaster", name: "Grandmaster", min: 1850, color: "#FF6B6B", text: "#ffffff" },
];

export function rankOfRating(rating: number): number {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (rating >= r.min) idx = i;
  });
  return idx;
}

export interface SeasonRecord {
  key: string; // YYYY-M
  peak: number;
  endRating: number;
  rankIdx: number; // rank held at season end
}

export interface PromoState {
  wins: number;
  losses: number;
  target: number; // rank index being fought for
}

export interface EngineState {
  rating: number;
  rankIdx: number;
  promo: PromoState | null;
  seasonKey: string;
  seasonPeak: number;
  seasons: SeasonRecord[];
  peakAllTime: number;
  decayingSince: number | null; // last activity ms (for "decaying" UI hints)
}

export interface RatingPoint {
  i: number;
  rating: number;
  delta: number;
  at: number;
  title: string;
  probElo: number;
  solved: boolean;
  rematchWin: boolean;
  farmed: boolean; // hit the cutoff, earned nothing
  decayed: number; // decay applied just before this attempt
}

function seasonKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function dayDiff(aMs: number, bMs: number): number {
  const a = new Date(aMs);
  const b = new Date(bMs);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

function scoreOf(a: EnrichedAttempt): number {
  if (!a.solved) return 0;
  if (a.result === "solved_with_help") return 0.5;
  return a.firstTry && !a.ai && !a.hints ? 1 : 0.85;
}

function kMultiplier(a: EnrichedAttempt, rematchWin: boolean): number {
  let m = 1;
  const mod = modifierOf(a.slug);
  if (mod === "elite") m *= 1.5;
  if (mod === "timed" && a.solved && a.totalTime > 0 && a.totalTime <= timedLimit(a.difficulty)) m *= 1.25;
  if (mod === "purist" && a.solved && !a.ai && !a.hints) m *= 1.25;
  if (rematchWin) m *= 1.25;
  return m;
}

// Decay for an idle gap within one season, floored at the current rank's min.
function decayFor(gapDays: number, rating: number, rankIdx: number): number {
  const idle = gapDays - DECAY_GRACE_DAYS;
  if (idle <= 0) return 0;
  const room = Math.max(0, rating - RANKS[rankIdx].min);
  return Math.min(idle * DECAY_PER_DAY, room);
}

export interface EngineResult {
  points: RatingPoint[];
  state: EngineState;
}

export function ratingEngine(attempts?: EnrichedAttempt[], now = Date.now()): EngineResult {
  const data = attempts ?? getEnrichedAttempts();
  const st: EngineState = {
    rating: START_RATING,
    rankIdx: 0,
    promo: null,
    seasonKey: data.length ? seasonKeyOf(data[0].at) : seasonKeyOf(now),
    seasonPeak: START_RATING,
    seasons: [],
    peakAllTime: START_RATING,
    decayingSince: null,
  };
  const lastFailed = new Map<string, boolean>();
  const points: RatingPoint[] = [];
  let prevAt: number | null = null;

  const advanceTime = (toMs: number): number => {
    // Season rollover: bank the season, soft-reset toward 1000. Decay debt is
    // forgiven across the boundary (fresh season, fresh legs).
    const toKey = seasonKeyOf(toMs);
    let decayApplied = 0;
    if (toKey !== st.seasonKey) {
      st.seasons.push({
        key: st.seasonKey,
        peak: st.seasonPeak,
        endRating: st.rating,
        rankIdx: st.rankIdx,
      });
      st.rating = Math.round((st.rating + START_RATING) / 2);
      st.rankIdx = rankOfRating(st.rating);
      st.promo = null;
      st.seasonKey = toKey;
      st.seasonPeak = st.rating;
    } else if (prevAt !== null) {
      decayApplied = decayFor(dayDiff(toMs, prevAt), st.rating, st.rankIdx);
      st.rating -= decayApplied;
    }
    return decayApplied;
  };

  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    const decayed = advanceTime(a.at);

    const rematchWin = a.solved && lastFailed.get(a.slug) === true;
    const farmed = a.solved && a.elo < st.rating - FARM_CUTOFF;
    let delta: number;
    if (farmed) {
      // Beneath you — only flat event/relic bonuses survive.
      delta = a.ratingBonusFlat;
    } else {
      const expected = 1 / (1 + Math.pow(10, (a.elo - st.rating) / 400));
      delta =
        Math.round(K * kMultiplier(a, rematchWin) * (scoreOf(a) - expected) * a.ratingBonusMult) +
        a.ratingBonusFlat;
    }
    st.rating = Math.max(100, st.rating + delta);

    // ---- promotion series ----
    if (st.promo) {
      if (a.solved) st.promo.wins++;
      else st.promo.losses++;
      if (st.promo.wins >= PROMO_WINS_NEEDED) {
        st.rankIdx = st.promo.target;
        st.promo = null;
      } else if (st.promo.losses > PROMO_LOSSES_ALLOWED) {
        st.rating = Math.max(RANKS[st.rankIdx].min, st.rating - PROMO_FAIL_PENALTY);
        st.promo = null;
      }
    }
    // Arm a promo once rating crosses the next rank's floor (the crossing
    // attempt itself doesn't count — the series starts fresh).
    if (!st.promo && st.rankIdx < RANKS.length - 1 && st.rating >= RANKS[st.rankIdx + 1].min) {
      st.promo = { wins: 0, losses: 0, target: st.rankIdx + 1 };
    }
    // ---- demotion ----
    if (st.rankIdx > 0 && st.rating < RANKS[st.rankIdx].min - DEMOTION_GRACE) {
      st.rankIdx--;
      st.promo = null;
    }

    st.seasonPeak = Math.max(st.seasonPeak, st.rating);
    st.peakAllTime = Math.max(st.peakAllTime, st.rating);
    lastFailed.set(a.slug, !a.solved);
    prevAt = a.at;

    points.push({
      i: i + 1,
      rating: st.rating,
      delta,
      at: a.at,
      title: a.title,
      probElo: a.elo,
      solved: a.solved,
      rematchWin,
      farmed,
      decayed,
    });
  }

  // Bring the clock to "now": season rollover + live decay.
  advanceTime(now);
  st.seasonPeak = Math.max(st.seasonPeak, st.rating);
  st.decayingSince = prevAt;

  return { points, state: st };
}

// ---------------- convenience accessors ----------------

export function ratingHistory(attempts?: EnrichedAttempt[]): RatingPoint[] {
  return ratingEngine(attempts).points;
}

export function currentEngine(): EngineState {
  return ratingEngine().state;
}

export function currentRating(): number {
  return currentEngine().rating;
}

export function currentRank(): Rank {
  return RANKS[currentEngine().rankIdx];
}

export function peakRating(): number {
  return currentEngine().peakAllTime;
}

// Days until decay starts eating rating (0 = decaying now). Null = no history.
export function decayCountdown(now = Date.now()): number | null {
  const st = currentEngine();
  if (st.decayingSince === null) return null;
  const idle = dayDiff(now, st.decayingSince);
  return Math.max(0, DECAY_GRACE_DAYS - idle);
}

export function farmCutoff(): number {
  return FARM_CUTOFF;
}
