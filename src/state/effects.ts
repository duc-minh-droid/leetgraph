// Buffs & debuffs: timed or use-limited status effects that bend rating, XP
// and coin payouts. Granted by events, node auras and quests; consumed by the
// submit pipeline; displayed on the map belt.
import { getInventory, updateInventory, type Inventory } from "./inventory";

export interface EffectDef {
  id: string;
  name: string;
  desc: string;
  kind: "buff" | "debuff";
  durationMs?: number; // wall-clock lifetime
  uses?: number; // or: consumed by N attempts
  // payout modifiers (applied at submit)
  ratingMult?: number;
  xpMult?: number;
  coinMult?: number;
  flat?: number; // flat rating delta
}

export const EFFECTS: EffectDef[] = [
  { id: "warmup", name: "Warmed Up", desc: "+25% rating gains.", kind: "buff", durationMs: 60 * 60 * 1000, ratingMult: 1.25 },
  { id: "focus", name: "Laser Focus", desc: "+50% XP for your next 3 attempts.", kind: "buff", uses: 3, xpMult: 1.5 },
  { id: "gilded-touch", name: "Gilded Touch", desc: "Double coins for 30 minutes.", kind: "buff", durationMs: 30 * 60 * 1000, coinMult: 2 },
  { id: "inspired", name: "Inspired", desc: "+10 rating on your next attempt.", kind: "buff", uses: 1, flat: 10 },
  { id: "heavy-arms", name: "Heavy Arms", desc: "−25% rating gains for an hour.", kind: "debuff", durationMs: 60 * 60 * 1000, ratingMult: 0.75 },
  { id: "butterfingers", name: "Butterfingers", desc: "Coins halved for 30 minutes.", kind: "debuff", durationMs: 30 * 60 * 1000, coinMult: 0.5 },
  { id: "jinxed", name: "Jinxed", desc: "−8 rating on your next attempt.", kind: "debuff", uses: 1, flat: -8 },
];

export interface ActiveEffect {
  id: string;
  until?: number; // epoch ms expiry
  uses?: number; // remaining attempts
}

export function effectById(id: string): EffectDef | undefined {
  return EFFECTS.find((e) => e.id === id);
}

function alive(e: ActiveEffect, now: number): boolean {
  if (e.until !== undefined && e.until <= now) return false;
  if (e.uses !== undefined && e.uses <= 0) return false;
  return Boolean(effectById(e.id));
}

export function activeEffects(inv?: Inventory, now = Date.now()): ActiveEffect[] {
  return (inv ?? getInventory()).effects.filter((e) => alive(e, now));
}

export function grantEffect(id: string) {
  const def = effectById(id);
  if (!def) return;
  updateInventory((inv) => ({
    effects: [
      ...activeEffects(inv).filter((e) => e.id !== id), // refresh, don't stack
      {
        id,
        until: def.durationMs ? Date.now() + def.durationMs : undefined,
        uses: def.uses,
      },
    ],
  }));
}

export function randomEffect(kind: "buff" | "debuff"): EffectDef {
  const pool = EFFECTS.filter((e) => e.kind === kind);
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface EffectPayout {
  ratingMult: number;
  xpMult: number;
  coinMult: number;
  flat: number;
  notes: string[];
}

// Applies active effects to one attempt: computes payout modifiers, burns a
// use from use-limited effects, prunes the dead ones.
export function consumeAttemptEffects(solved: boolean): EffectPayout {
  const now = Date.now();
  const inv = getInventory();
  const live = activeEffects(inv, now);
  const out: EffectPayout = { ratingMult: 1, xpMult: 1, coinMult: 1, flat: 0, notes: [] };
  for (const e of live) {
    const def = effectById(e.id)!;
    // Gain-modifiers only apply when they matter (solve for gains).
    if (def.ratingMult !== undefined && (solved || def.ratingMult < 1)) {
      out.ratingMult *= def.ratingMult;
      out.notes.push(`${def.name} ${def.ratingMult > 1 ? "+" : ""}${Math.round((def.ratingMult - 1) * 100)}%`);
    }
    if (def.xpMult !== undefined) {
      out.xpMult *= def.xpMult;
      out.notes.push(`${def.name} XP x${def.xpMult}`);
    }
    if (def.coinMult !== undefined) {
      out.coinMult *= def.coinMult;
      out.notes.push(`${def.name} coins x${def.coinMult}`);
    }
    if (def.flat) {
      out.flat += def.flat;
      out.notes.push(`${def.name} ${def.flat > 0 ? "+" : ""}${def.flat}`);
    }
  }
  updateInventory(() => ({
    effects: live
      .map((e) => (e.uses !== undefined ? { ...e, uses: e.uses - 1 } : e))
      .filter((e) => alive(e, now)),
  }));
  return out;
}
