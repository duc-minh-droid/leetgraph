// Node auras: daily-rotating RNG bonuses/hazards on ~1 in 6 nodes. Seeded by
// slug + calendar day so the map re-rolls every midnight — a reason to look
// at the board fresh each day.
export type Aura = "gilded" | "blessed" | "volatile" | "haunted" | "lucky";

export interface AuraMeta {
  label: string;
  desc: string;
  color: string; // badge bg
  text: string;
  icon: string; // emoji badge (8-bit spirit)
}

export const AURA_META: Record<Aura, AuraMeta> = {
  gilded: { label: "Gilded", desc: "Double coins from this node today.", color: "#FFD93D", text: "#000", icon: "🪙" },
  blessed: { label: "Blessed", desc: "+50% XP from this node today.", color: "#4D96FF", text: "#fff", icon: "✨" },
  volatile: { label: "Volatile", desc: "Rating swings ±25% harder here today.", color: "#FF6FB5", text: "#fff", icon: "⚡" },
  haunted: { label: "Haunted", desc: "Failing here today likely curses you…", color: "#1a1a1a", text: "#FF6B6B", icon: "👻" },
  lucky: { label: "Lucky", desc: "Solving here today may drop a relic chest.", color: "#4ADE80", text: "#000", icon: "🍀" },
};

const AURAS: Aura[] = ["gilded", "blessed", "volatile", "haunted", "lucky"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ~1 in 6 nodes carries an aura today.
export function auraOf(slug: string, now = Date.now()): Aura | null {
  const h = hash(`aura:${slug}:${dayKey(now)}`);
  if (h % 6 !== 0) return null;
  return AURAS[(h >>> 8) % AURAS.length];
}
