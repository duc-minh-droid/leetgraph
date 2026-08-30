// Central attempt-submission pipeline: stamps roguelike effects onto the
// attempt, writes it, then diffs every derived system (rating, achievements,
// quest, curses, chests) so the UI can celebrate exactly what changed.
import { addAttempt, getAttempts, getAllAttempts, type Attempt } from "./attempts";
import { currentEngine, ratingEngine, RANKS, type PromoState } from "./rating";
import { unlockedAchievements, ACHIEVEMENTS, type AchievementDef } from "./achievements";
import { todaysQuest } from "./quests";
import { getInventory, updateInventory } from "./inventory";
import { computeAttemptBonus, rollCurse, cleanseCheck, curseById } from "./relics";
import { modifierOf } from "./modifiers";

export interface SubmitOptions {
  secondChance?: boolean; // Second Chance potion armed for this attempt
  isBossNode?: boolean; // act convergence node (guaranteed chest on solve)
}

export interface SubmitOutcome {
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  newAchievements: AchievementDef[];
  questJustCompleted: boolean;
  crit: boolean;
  effectNotes: string[];
  curseGained: string | null; // curse name
  curseCleansed: string | null;
  chestDropped: boolean;
  comboToday: number; // solves today, for the combo chip
  // Competitive frame events.
  rankUp: string | null; // new rank name when promoted this attempt
  rankDown: string | null;
  promo: PromoState | null; // active promo series after this attempt
  promoArmed: boolean; // promo just started
  promoLost: boolean; // promo series just failed
  farmed: boolean; // hit the farming cutoff — earned nothing
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function submitAttempt(slug: string, attempt: Attempt, opts: SubmitOptions = {}): SubmitOutcome {
  const engineBefore = currentEngine();
  const ratingBefore = engineBefore.rating;
  const achBefore = unlockedAchievements();
  const questBefore = todaysQuest().done;

  const solved = attempt.result === "solved" || attempt.result === "solved_with_help";
  const clean = !attempt.ai && !attempt.hints;
  const today = dayKey(attempt.at);
  const all = Object.values(getAllAttempts()).flat();
  const firstSolveToday = !all.some(
    (a) => dayKey(a.at) === today && (a.result === "solved" || a.result === "solved_with_help")
  );

  // Roll relic/curse/event effects ONCE and stamp them on the attempt.
  const bonus = computeAttemptBonus({
    slug,
    solved,
    clean,
    firstTry: getAttempts(slug).length === 0 && attempt.result === "solved",
    firstSolveToday,
    secondChanceArmed: Boolean(opts.secondChance),
  });
  const stamped: Attempt = {
    ...attempt,
    ratingBonusMult: bonus.mult,
    ratingBonusFlat: bonus.flat,
    effectNotes: bonus.notes.length ? bonus.notes : undefined,
    noRematch: bonus.secondChance || undefined,
  };

  // Consume one-shot state: pending event bonus + armed potion.
  updateInventory((inv) => {
    const potions = [...inv.potions];
    if (opts.secondChance) {
      const i = potions.indexOf("second-chance");
      if (i >= 0) potions.splice(i, 1);
    }
    return { pendingBonus: 0, potions };
  });

  addAttempt(slug, stamped);

  // Curses: cleanse first (this attempt may cure), otherwise maybe gain one.
  let curseCleansed: string | null = null;
  let curseGained: string | null = null;
  const inv = getInventory();
  if (inv.curse && cleanseCheck(stamped)) {
    curseCleansed = curseById(inv.curse)?.name ?? inv.curse;
    updateInventory({ curse: null });
  } else {
    const rolled = rollCurse(stamped, slug);
    if (rolled) {
      curseGained = curseById(rolled)?.name ?? rolled;
      updateInventory({ curse: rolled });
    }
  }

  // Chests: boss nodes always drop on a solve; elites 30% of the time.
  let chestDropped = false;
  if (solved && !getInventory().pendingChest) {
    if (opts.isBossNode || (modifierOf(slug) === "elite" && Math.random() < 0.3)) {
      chestDropped = true;
      updateInventory({
        pendingChest: { seed: (Date.now() % 2147483647) | 1, source: opts.isBossNode ? "boss" : "elite" },
      });
    }
  }

  const comboToday = solved
    ? Object.values(getAllAttempts())
        .flat()
        .filter((a) => dayKey(a.at) === today && (a.result === "solved" || a.result === "solved_with_help")).length
    : 0;

  const engineResult = ratingEngine();
  const engineAfter = engineResult.state;
  const ratingAfter = engineAfter.rating;
  const achAfter = unlockedAchievements();
  const newAchievements = ACHIEVEMENTS.filter((a) => achAfter.has(a.id) && !achBefore.has(a.id));
  const questJustCompleted = !questBefore && todaysQuest().done;
  // The just-submitted attempt is the final replay point — the engine already
  // knows whether it hit the farming cutoff.
  const farmed = engineResult.points[engineResult.points.length - 1]?.farmed ?? false;

  return {
    ratingBefore,
    ratingAfter,
    ratingDelta: ratingAfter - ratingBefore,
    newAchievements,
    questJustCompleted,
    crit: bonus.crit || ratingAfter - ratingBefore >= 25,
    effectNotes: bonus.notes,
    curseGained,
    curseCleansed,
    chestDropped,
    comboToday,
    rankUp: engineAfter.rankIdx > engineBefore.rankIdx ? RANKS[engineAfter.rankIdx].name : null,
    rankDown: engineAfter.rankIdx < engineBefore.rankIdx ? RANKS[engineAfter.rankIdx].name : null,
    promo: engineAfter.promo,
    promoArmed: !engineBefore.promo && Boolean(engineAfter.promo),
    promoLost:
      Boolean(engineBefore.promo) && !engineAfter.promo && engineAfter.rankIdx === engineBefore.rankIdx,
    farmed,
  };
}
