// Roguelike node modifiers, deterministically derived from the problem slug so
// they are stable across maps, sessions, and devices (same trick as the map's
// layout jitter). ~10% of problems get each modifier.
//
//   elite  — higher stakes: rating swings are amplified both ways
//   timed  — beat it under a difficulty-scaled limit for a rating bonus
//   purist — solve without AI or hints for a rating bonus

export type Modifier = "elite" | "timed" | "purist";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function modifierOf(slug: string): Modifier | null {
  switch (hash(slug) % 10) {
    case 0:
      return "elite";
    case 1:
      return "timed";
    case 2:
      return "purist";
    default:
      return null;
  }
}

// Time limit (seconds) for "timed" nodes, scaled by difficulty.
export function timedLimit(difficulty: string): number {
  switch (difficulty) {
    case "EASY":
      return 15 * 60;
    case "MEDIUM":
      return 25 * 60;
    case "HARD":
      return 40 * 60;
    default:
      return 25 * 60;
  }
}

export const MODIFIER_META: Record<Modifier, { label: string; desc: string }> = {
  elite: { label: "Elite", desc: "High stakes — rating swings ×1.5 both ways." },
  timed: { label: "Timed", desc: "Beat the clock for a rating bonus." },
  purist: { label: "Purist", desc: "No AI, no hints — for a rating bonus." },
};
