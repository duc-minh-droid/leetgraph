// Central attempt-submission pipeline: writes the attempt, then diffs every
// derived system (rating, achievements, quest) so the UI can celebrate exactly
// what changed.
import { addAttempt, type Attempt } from "./attempts";
import { currentRating } from "./rating";
import { unlockedAchievements, ACHIEVEMENTS, type AchievementDef } from "./achievements";
import { todaysQuest } from "./quests";

export interface SubmitOutcome {
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  newAchievements: AchievementDef[];
  questJustCompleted: boolean;
}

export function submitAttempt(slug: string, attempt: Attempt): SubmitOutcome {
  const ratingBefore = currentRating();
  const achBefore = unlockedAchievements();
  const questBefore = todaysQuest().done;

  addAttempt(slug, attempt);

  const ratingAfter = currentRating();
  const achAfter = unlockedAchievements();
  const newAchievements = ACHIEVEMENTS.filter((a) => achAfter.has(a.id) && !achBefore.has(a.id));
  const questJustCompleted = !questBefore && todaysQuest().done;

  return {
    ratingBefore,
    ratingAfter,
    ratingDelta: ratingAfter - ratingBefore,
    newAchievements,
    questJustCompleted,
  };
}
