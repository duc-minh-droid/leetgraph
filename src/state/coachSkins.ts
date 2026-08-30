// Coach skins: each one is a reward tied to an achievement. Cubee is the
// starter. Equipped skin persists in localStorage.
import cubee from "../../coaches/cubee.avatar.json";
import strobi from "../../coaches/strobi.avatar.json";
import kirby from "../../coaches/kirby.avatar.json";
import sunee from "../../coaches/sunee.avatar.json";
import cloudee from "../../coaches/cloudee.avatar.json";
import citrus from "../../coaches/citrus.avatar.json";
import nova from "../../coaches/nova.avatar.json";
import onee from "../../coaches/onee.avatar.json";
import freddy from "../../coaches/freddy.avatar.json";
import grokBot from "../../coaches/grok-bot.avatar.json";
import { unlockedAchievements, ACHIEVEMENTS } from "./achievements";

// Some editor exports carry roundness values > 1, which the schema rejects
// (and createAvatar throws on). Clamp them instead of crashing.
function sanitize(def: unknown): unknown {
  const d = structuredClone(def) as {
    body?: { primary?: Record<string, unknown>; nodes?: { surface?: Record<string, unknown> }[] };
  };
  const clamp = (s?: Record<string, unknown>) => {
    if (!s) return;
    for (const k of ["roundness", "morphRoundness", "tipRoundness", "baseRoundness"]) {
      const v = s[k];
      if (typeof v === "number") s[k] = Math.min(1, Math.max(0, v));
    }
  };
  clamp(d.body?.primary);
  d.body?.nodes?.forEach((n) => clamp(n.surface));
  return d;
}

export interface CoachSkin {
  id: string;
  name: string;
  // Definition JSON (validated by createAvatar at mount).
  def: unknown;
  color: string;
  // Achievement id required to unlock; null = always available.
  achievement: string | null;
}

export const COACH_SKINS: CoachSkin[] = [
  { id: "cubee", name: "Cubee", def: sanitize(cubee), color: "#e65c5c", achievement: null },
  { id: "strobi", name: "Strobi", def: sanitize(strobi), color: "#5b7fe5", achievement: "first-blood" },
  { id: "sunee", name: "Sunee", def: sanitize(sunee), color: "#e69a5c", achievement: "streak-3" },
  { id: "kirby", name: "Kirby", def: sanitize(kirby), color: "#ffc2e9", achievement: "flawless" },
  { id: "cloudee", name: "Cloudee", def: sanitize(cloudee), color: "#c9cbcf", achievement: "no-crutches" },
  { id: "citrus", name: "Citrus", def: sanitize(citrus), color: "#ffcf24", achievement: "comeback" },
  { id: "nova", name: "Nova", def: sanitize(nova), color: "#55b6c3", achievement: "club-1200" },
  { id: "onee", name: "Onee", def: sanitize(onee), color: "#dbe2f5", achievement: "dutiful" },
  { id: "freddy", name: "Freddy", def: sanitize(freddy), color: "#e6855c", achievement: "boss-slayer" },
  { id: "grok-bot", name: "Grok Bot", def: sanitize(grokBot), color: "#000000", achievement: "club-1400" },
];

const KEY = "leetgraph.coachSkin";

export function isSkinUnlocked(skin: CoachSkin, unlocked = unlockedAchievements()): boolean {
  return skin.achievement === null || unlocked.has(skin.achievement);
}

export function equippedSkin(): CoachSkin {
  const id = localStorage.getItem(KEY);
  const unlocked = unlockedAchievements();
  const skin = COACH_SKINS.find((s) => s.id === id);
  if (skin && isSkinUnlocked(skin, unlocked)) return skin;
  return COACH_SKINS[0];
}

export function equipSkin(id: string) {
  localStorage.setItem(KEY, id);
  window.dispatchEvent(
    new CustomEvent("leetgraph:persist", { detail: { kind: "profile", coachSkin: id } })
  );
}

// Cloud hydration setter — no persist emit.
export function setSkinLocal(id: string | null) {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
}

// The skin (if any) rewarded by a given achievement — for unlock callouts.
export function skinForAchievement(achievementId: string): CoachSkin | undefined {
  return COACH_SKINS.find((s) => s.achievement === achievementId);
}

export function skinForAchievementName(name: string): CoachSkin | undefined {
  const ach = ACHIEVEMENTS.find((a) => a.name === name);
  return ach ? skinForAchievement(ach.id) : undefined;
}

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}
