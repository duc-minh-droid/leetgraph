import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FaTrophy, FaLock, FaCrown, FaUserGroup, FaRankingStar, FaFire } from "react-icons/fa6";
import {
  ACHIEVEMENTS,
  unlockedAchievements,
  equippedTitle,
  equipTitle,
} from "../state/achievements";
import {
  COACH_SKINS,
  isSkinUnlocked,
  equippedSkin,
  equipSkin,
  achievementName,
} from "../state/coachSkins";
import { currentRating, peakRating } from "../state/rating";
import { currentStreak } from "../state/analytics";
import { emitCoach } from "../state/coachBus";
import { CoachPreview } from "./Coach";
import "../analytics.css";

function Achievements({ rev, onChanged }: { rev: number; onChanged?: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => equippedTitle(), [rev]);
  return (
    <div className="ach-grid">
      {ACHIEVEMENTS.map((a) => {
        const isUnlocked = unlocked.has(a.id);
        const isEquipped = a.title === equipped;
        return (
          <motion.div
            key={a.id}
            whileHover={isUnlocked ? { y: -3, rotate: -1 } : {}}
            className={`ach-card ${isUnlocked ? "" : "locked"}`}
          >
            <div className="flex items-center gap-2">
              {isUnlocked ? <FaTrophy className="text-neo-orange" /> : <FaLock className="opacity-40" />}
              <strong>{a.name}</strong>
            </div>
            <p>{a.desc}</p>
            {a.title && (
              <motion.button
                whileHover={isUnlocked ? { scale: 1.08, rotate: -2 } : {}}
                whileTap={isUnlocked ? { scale: 0.9 } : {}}
                disabled={!isUnlocked}
                onClick={() => {
                  equipTitle(a.title!);
                  onChanged?.();
                }}
                className={`ach-title ${isEquipped ? "equipped" : ""}`}
                title={isUnlocked ? "Equip this title" : "Unlock to equip"}
              >
                {isEquipped && <FaCrown className="mr-1 inline text-[10px]" />}
                {a.title}
              </motion.button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function CoachLocker({ rev, onChanged }: { rev: number; onChanged?: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => {
    void rev;
    return equippedSkin().id;
  }, [rev]);
  return (
    <div className="coach-grid">
      {COACH_SKINS.map((skin) => {
        const open = isSkinUnlocked(skin, unlocked);
        const isEquipped = skin.id === equipped;
        return (
          <motion.button
            key={skin.id}
            whileHover={open ? { y: -4, rotate: -1 } : {}}
            whileTap={open ? { scale: 0.93 } : {}}
            disabled={!open}
            onClick={() => {
              equipSkin(skin.id);
              emitCoach({ type: "skin-equipped", name: skin.name });
              onChanged?.();
            }}
            className={`coach-card ${open ? "" : "locked"} ${isEquipped ? "equipped" : ""}`}
            title={
              open
                ? isEquipped
                  ? `${skin.name} is your coach`
                  : `Equip ${skin.name}`
                : `Unlock via "${achievementName(skin.achievement!)}"`
            }
          >
            <div className={open ? "" : "grayscale opacity-50"}>
              <CoachPreview skinId={skin.id} size={64} />
            </div>
            <strong>{skin.name}</strong>
            <span className="coach-req">
              {!open ? (
                <>
                  <FaLock className="inline text-[9px]" /> {achievementName(skin.achievement!)}
                </>
              ) : isEquipped ? (
                <>
                  <FaCrown className="inline text-[9px]" /> Equipped
                </>
              ) : skin.achievement ? (
                achievementName(skin.achievement)
              ) : (
                "Starter"
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function AchievementsView({ onChanged }: { onChanged?: () => void }) {
  const [rev, setRev] = useState(0);
  const changed = () => {
    setRev((r) => r + 1);
    onChanged?.();
  };
  const unlockedCount = useMemo(() => unlockedAchievements().size, [rev]);
  const rating = useMemo(() => currentRating(), [rev]);
  const peak = useMemo(() => peakRating(), [rev]);
  const streak = useMemo(() => currentStreak(), [rev]);

  return (
    <div className="analytics">
      <div className="stat-row">
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="stat">
          <strong>
            {unlockedCount}/{ACHIEVEMENTS.length}
          </strong>
          <span>Achievements</span>
        </motion.div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="stat">
          <strong>
            <FaRankingStar className="mr-1 inline text-neo-accent" />
            {rating}
          </strong>
          <span>Elo</span>
        </motion.div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="stat">
          <strong>{peak}</strong>
          <span>Peak Elo</span>
        </motion.div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="stat">
          <strong>
            <FaFire className="mr-1 inline text-neo-orange" />
            {streak}
          </strong>
          <span>Day streak</span>
        </motion.div>
      </div>

      <div className="dash-grid">
        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaTrophy className="mr-1 inline text-neo-orange" />Achievements</h3>
          <p className="dash-sub">Unlock achievements to earn titles — click an unlocked title to wear it.</p>
          <Achievements rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaUserGroup className="mr-1 inline text-neo-pink" />Coach locker</h3>
          <p className="dash-sub">Coaches are achievement rewards — unlock them by playing, click one to make it yours.</p>
          <CoachLocker rev={rev} onChanged={changed} />
        </motion.section>
      </div>
    </div>
  );
}
