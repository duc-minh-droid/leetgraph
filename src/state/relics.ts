// Relics (passive rule-benders), curses (debuffs), and potions (consumables).
// All rating effects are computed at submit time and STAMPED ONTO THE ATTEMPT
// (ratingBonusMult / ratingBonusFlat), so the rating replay stays a pure
// function of history even as your inventory changes.
import type { Attempt } from "./attempts";
import { getInventory } from "./inventory";
import { modifierOf, timedLimit } from "./modifiers";
import { currentLevel } from "./xp";

export type Rarity = "common" | "rare" | "legendary";

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  minLevel?: number; // player level required before this can drop
}

export const RELICS: RelicDef[] = [
  { id: "rubber-duck", name: "Rubber Duck", desc: "First solve of the day earns +50% rating.", rarity: "common" },
  { id: "warm-coffee", name: "Warm Coffee", desc: "+2 flat rating on every solve.", rarity: "common" },
  { id: "espresso", name: "Espresso Shot", desc: "Timed nodes get +5 minutes.", rarity: "common" },
  { id: "sponge", name: "Sponge", desc: "Assisted solves lose 30% less rating potential.", rarity: "common" },
  { id: "xp-charm", name: "XP Charm", desc: "+5 XP on every attempt.", rarity: "common" },
  { id: "lucky-coin", name: "Lucky Coin", desc: "15% chance any rating gain is doubled. CRIT!", rarity: "rare" },
  { id: "loaded-dice", name: "Loaded Dice", desc: "Every solve rolls +0 to +8 bonus rating.", rarity: "rare" },
  { id: "sturdy-helm", name: "Sturdy Helm", desc: "Rating losses are softened by 30%.", rarity: "rare" },
  { id: "scholars-tome", name: "Scholar's Tome", desc: "Solves earn +50% XP.", rarity: "rare", minLevel: 3 },
  { id: "cursed-skull", name: "Cursed Skull", desc: "Elite gains ×2 — but elite losses ×2 too.", rarity: "legendary", minLevel: 4 },
  { id: "crown", name: "Grinder's Crown", desc: "Clean first-try solves earn +15 flat rating.", rarity: "legendary", minLevel: 6 },
];

export interface CurseDef {
  id: string;
  name: string;
  desc: string;
  cleanse: string;
}

export const CURSES: CurseDef[] = [
  { id: "brain-fog", name: "Brain Fog", desc: "Rating gains halved.", cleanse: "Cleanse: one clean solve (no AI/hints)." },
  { id: "gravity", name: "Gravity", desc: "Rating losses hit 25% harder.", cleanse: "Cleanse: any solve." },
];

export interface PotionDef {
  id: string;
  name: string;
  desc: string;
}

export const POTIONS: PotionDef[] = [
  { id: "quest-reroll", name: "Quest Reroll", desc: "Reroll today's daily quest." },
  { id: "second-chance", name: "Second Chance", desc: "Arm before submitting: a fail costs no rating and skips the rematch queue." },
  { id: "small-tonic", name: "Small Tonic", desc: "+10 rating on your next attempt." },
];

export function relicById(id: string): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}
export function curseById(id: string): CurseDef | undefined {
  return CURSES.find((c) => c.id === id);
}
export function potionById(id: string): PotionDef | undefined {
  return POTIONS.find((p) => p.id === id);
}

// Achievements that don't reward a coach skin reward a relic instead.
export const RELIC_FOR_ACHIEVEMENT: Record<string, string> = {
  grinder: "xp-charm",
  machine: "scholars-tome",
  redeemer: "sturdy-helm",
  "streak-7": "rubber-duck",
  "club-1600": "crown",
  "elite-hunter": "cursed-skull",
  "speed-demon": "espresso",
  "hard-boiled": "lucky-coin",
  interviewee: "warm-coffee",
};

export function relicForAchievement(achievementId: string): RelicDef | undefined {
  const id = RELIC_FOR_ACHIEVEMENT[achievementId];
  return id ? relicById(id) : undefined;
}

// Rarity-weighted draft of `n` relics you don't own yet (level-gated relics
// stay out of the pool until you've earned them).
export function draftRelics(seed: number, n = 3): RelicDef[] {
  const owned = new Set(getInventory().relics);
  const level = currentLevel();
  const pool = RELICS.filter((r) => !owned.has(r.id) && (r.minLevel ?? 0) <= level);
  const weight = (r: RelicDef) => (r.rarity === "common" ? 6 : r.rarity === "rare" ? 3 : 1);
  let s = seed >>> 0 || 1;
  const rand = () => ((s = Math.imul(s, 48271) % 2147483647) >>> 0) / 2147483647;
  const picks: RelicDef[] = [];
  const candidates = [...pool];
  while (picks.length < n && candidates.length) {
    const total = candidates.reduce((a, r) => a + weight(r), 0);
    let roll = rand() * total;
    const idx = candidates.findIndex((r) => (roll -= weight(r)) <= 0);
    picks.push(candidates.splice(Math.max(0, idx), 1)[0]);
  }
  return picks;
}

export interface AttemptBonus {
  mult: number;
  flat: number;
  crit: boolean; // lucky-coin proc
  notes: string[]; // human-readable effect log for the celebration
  secondChance: boolean;
  timedLimitBonus: number; // extra seconds on timed nodes (espresso)
}

interface BonusCtx {
  slug: string;
  solved: boolean;
  clean: boolean; // no ai/hints
  firstTry: boolean;
  firstSolveToday: boolean;
  secondChanceArmed: boolean;
}

// Computes the relic/curse/pending effects for one attempt. Random rolls
// happen HERE, once, and get stamped onto the attempt.
export function computeAttemptBonus(ctx: BonusCtx): AttemptBonus {
  const inv = getInventory();
  const has = (id: string) => inv.relics.includes(id);
  const mod = modifierOf(ctx.slug);
  let mult = 1;
  let flat = 0;
  let crit = false;
  const notes: string[] = [];

  if (ctx.solved) {
    if (has("rubber-duck") && ctx.firstSolveToday) {
      mult *= 1.5;
      notes.push("Rubber Duck +50%");
    }
    if (has("warm-coffee")) {
      flat += 2;
      notes.push("Warm Coffee +2");
    }
    if (has("crown") && ctx.firstTry && ctx.clean) {
      flat += 15;
      notes.push("Crown +15");
    }
    if (has("loaded-dice")) {
      const roll = Math.floor(Math.random() * 9);
      if (roll > 0) {
        flat += roll;
        notes.push(`Loaded Dice +${roll}`);
      }
    }
    if (has("lucky-coin") && Math.random() < 0.15) {
      mult *= 2;
      crit = true;
      notes.push("LUCKY COIN ×2");
    }
    if (has("sponge") && !ctx.clean) {
      mult *= 1.3;
      notes.push("Sponge +30%");
    }
  } else {
    if (ctx.secondChanceArmed) {
      mult = 0;
      notes.push("Second Chance — no rating lost");
    } else if (has("sturdy-helm")) {
      mult *= 0.7;
      notes.push("Sturdy Helm −30% loss");
    }
  }

  if (has("cursed-skull") && mod === "elite") {
    mult *= 2;
    notes.push(ctx.solved ? "Cursed Skull ×2" : "Cursed Skull ×2 loss");
  }

  // Active curse.
  if (inv.curse === "brain-fog" && ctx.solved) {
    mult *= 0.5;
    notes.push("Brain Fog −50%");
  }
  if (inv.curse === "gravity" && !ctx.solved && !ctx.secondChanceArmed) {
    mult *= 1.25;
    notes.push("Gravity +25% loss");
  }

  // Pending event bonus rides on this attempt.
  if (inv.pendingBonus !== 0) {
    flat += inv.pendingBonus;
    notes.push(`${inv.pendingBonus > 0 ? "+" : ""}${inv.pendingBonus} event bonus`);
  }

  return {
    mult,
    flat,
    crit,
    notes,
    secondChance: ctx.secondChanceArmed && !ctx.solved,
    timedLimitBonus: has("espresso") ? 300 : 0,
  };
}

export function effectiveTimedLimit(_slug: string, difficulty: string): number {
  const base = timedLimit(difficulty);
  return getInventory().relics.includes("espresso") ? base + 300 : base;
}

// Should this attempt's context roll a curse? Failing an elite = 40% chance.
export function rollCurse(a: Attempt, slug: string): string | null {
  const solved = a.result === "solved" || a.result === "solved_with_help";
  if (solved || modifierOf(slug) !== "elite") return null;
  if (getInventory().curse) return null; // one curse at a time
  return Math.random() < 0.4 ? CURSES[Math.floor(Math.random() * CURSES.length)].id : null;
}

// Curse cleansing rules, applied after an attempt.
export function cleanseCheck(a: Attempt): boolean {
  const inv = getInventory();
  const solved = a.result === "solved" || a.result === "solved_with_help";
  if (!inv.curse) return false;
  if (inv.curse === "brain-fog") return a.result === "solved" && !a.ai && !a.hints;
  if (inv.curse === "gravity") return solved;
  return false;
}
