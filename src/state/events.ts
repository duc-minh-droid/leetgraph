// Mystery "?" nodes: seeded per slug so placement is stable, event outcome is
// rolled once on first open and remembered via inventory.eventsSeen.
import { getInventory, updateInventory } from "./inventory";
import { modifierOf } from "./modifiers";
import { POTIONS } from "./relics";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ~12% of nodes are mystery nodes (skips nodes that already carry a modifier
// so effects don't stack confusingly).
export function isMysteryNode(slug: string): boolean {
  return modifierOf(slug) === null && hash("mystery:" + slug) % 8 === 0;
}

export function mysteryPending(slug: string): boolean {
  return isMysteryNode(slug) && !getInventory().eventsSeen.includes(slug);
}

export type MysteryEvent =
  | { type: "blind"; title: string; desc: string; bonus: number }
  | { type: "gamble"; title: string; desc: string; wager: number }
  | { type: "gift"; title: string; desc: string; bonus: number }
  | { type: "potion"; title: string; desc: string; potionId: string };

// The event a slug hides — deterministic per slug.
export function eventFor(slug: string): MysteryEvent {
  switch (hash("event:" + slug) % 4) {
    case 0:
      return {
        type: "blind",
        title: "Fog of War",
        desc: "The problem stays hidden until you commit. Solve it blind for a +12 rating bounty.",
        bonus: 12,
      };
    case 1:
      return {
        type: "gamble",
        title: "The Gambler",
        desc: "Flip a coin: heads +15 rating on your next attempt, tails −15. Then face the problem.",
        wager: 15,
      };
    case 2:
      return {
        type: "gift",
        title: "Free Lunch",
        desc: "A stranger's leftover rating. +8 on your next attempt, no strings attached.",
        bonus: 8,
      };
    default: {
      const potion = POTIONS[hash("potion:" + slug) % POTIONS.length];
      return {
        type: "potion",
        title: "Field Supplies",
        desc: `You found a ${potion.name}! (${potion.desc})`,
        potionId: potion.id,
      };
    }
  }
}

export interface EventResolution {
  message: string;
  coinResult?: "heads" | "tails";
  blind: boolean; // proceed to the problem with title/elo hidden
}

// Resolve the event's effect (rolls happen here, once) and mark it seen.
export function resolveEvent(slug: string): EventResolution {
  const ev = eventFor(slug);
  let res: EventResolution;
  switch (ev.type) {
    case "blind":
      updateInventory((inv) => ({ pendingBonus: inv.pendingBonus + ev.bonus }));
      res = { message: `+${ev.bonus} bounty armed. Good luck in the dark.`, blind: true };
      break;
    case "gamble": {
      const heads = Math.random() < 0.5;
      updateInventory((inv) => ({
        pendingBonus: inv.pendingBonus + (heads ? ev.wager : -ev.wager),
      }));
      res = {
        message: heads ? `HEADS! +${ev.wager} rating armed.` : `Tails… −${ev.wager} rating. Ouch.`,
        coinResult: heads ? "heads" : "tails",
        blind: false,
      };
      break;
    }
    case "gift":
      updateInventory((inv) => ({ pendingBonus: inv.pendingBonus + ev.bonus }));
      res = { message: `+${ev.bonus} rating armed for your next attempt.`, blind: false };
      break;
    case "potion":
      updateInventory((inv) => ({ potions: [...inv.potions, ev.potionId] }));
      res = { message: "Added to your potion belt.", blind: false };
      break;
  }
  updateInventory((inv) => ({ eventsSeen: [...inv.eventsSeen, slug] }));
  return res;
}
