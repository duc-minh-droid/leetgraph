// Roguelike inventory: relics (passive), potions (consumable), an active
// curse, pending rating bonuses from events, and an unopened chest draft.
// Mirrors to localStorage and syncs to profiles.inventory via leetgraph:persist.

export interface Inventory {
  relics: string[];
  potions: string[];
  curse: string | null;
  // Flat rating bonus applied to (and consumed by) the next attempt — how
  // events grant/charge rating without breaking the attempt-replay model.
  pendingBonus: number;
  // Chest waiting to be opened (seed drives the 3-relic draft).
  pendingChest: { seed: number; source: string } | null;
  // Per-day quest reroll offsets (potion effect).
  questRerolls: Record<string, number>;
  // Slugs of mystery/event nodes already triggered (event fires once).
  eventsSeen: string[];
}

const KEY = "leetgraph.inventory";

const EMPTY: Inventory = {
  relics: [],
  potions: [],
  curse: null,
  pendingBonus: 0,
  pendingChest: null,
  questRerolls: {},
  eventsSeen: [],
};

export function getInventory(): Inventory {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...EMPTY };
  }
}

export function updateInventory(patch: Partial<Inventory> | ((inv: Inventory) => Partial<Inventory>)) {
  const inv = getInventory();
  const next = { ...inv, ...(typeof patch === "function" ? patch(inv) : patch) };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent("leetgraph:persist", { detail: { kind: "inventory", inventory: next } })
  );
  return next;
}

// Cloud hydration setter — no persist emit.
export function setInventoryLocal(inv: Inventory | null) {
  if (inv) localStorage.setItem(KEY, JSON.stringify({ ...EMPTY, ...inv }));
  else localStorage.removeItem(KEY);
}
