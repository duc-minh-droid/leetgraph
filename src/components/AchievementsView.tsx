// Profile: who you are and everything you've earned — avatar, titles,
// unlocked achievements, coaches, relics, potions, seasons. The full catalog
// and all purchases live in the Shop tab.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FaTrophy,
  FaCrown,
  FaUserGroup,
  FaRankingStar,
  FaFire,
  FaCalendarDays,
  FaCheck,
  FaGem,
  FaFlask,
} from "react-icons/fa6";
import {
  ACHIEVEMENTS,
  unlockedAchievements,
  equippedTitle,
  equipTitle,
} from "../state/achievements";
import { COACH_SKINS, isSkinUnlocked, equippedSkin, equipSkin } from "../state/coachSkins";
import { relicById, potionById, relicForAchievement, type Rarity } from "../state/relics";
import { currentEngine, RANKS } from "../state/rating";
import { currentStreak } from "../state/analytics";
import { levelInfo } from "../state/xp";
import { getInventory } from "../state/inventory";
import { avatarUrl, ensureAvatar, equipAvatar } from "../lib/avatars";
import { sfx } from "../lib/sfx";
import { emitCoach } from "../state/coachBus";
import { CoachPreview } from "./Coach";
import "../analytics.css";

const RARITY_BG: Record<Rarity, string> = {
  common: "bg-white",
  rare: "bg-neo-muted",
  legendary: "bg-neo-secondary",
};

// Unlocked achievements only, each with its reward chips + equippable title.
function UnlockedAchievements({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => equippedTitle(), [rev]);
  const list = ACHIEVEMENTS.filter((a) => unlocked.has(a.id));
  if (list.length === 0) {
    return <p className="text-sm font-bold uppercase text-black/50">Nothing yet — go solve something. The Shop tab shows everything you can earn.</p>;
  }
  return (
    <div className="ach-grid">
      {list.map((a) => {
        const coach = COACH_SKINS.find((s) => s.achievement === a.id);
        const relic = relicForAchievement(a.id);
        const isEquipped = a.title === equipped;
        return (
          <motion.div key={a.id} whileHover={{ y: -3, rotate: -1 }} className="ach-card">
            <div className="flex items-center gap-2">
              <FaTrophy className="text-neo-orange" />
              <strong>{a.name}</strong>
            </div>
            <p>{a.desc}</p>
            <div className="flex flex-wrap items-center gap-1">
              {coach && (
                <span className="flex items-center gap-1 border-2 border-black bg-neo-pink px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                  <FaUserGroup /> {coach.name}
                </span>
              )}
              {relic && (
                <span className="flex items-center gap-1 border-2 border-black bg-neo-muted px-1.5 py-0.5 text-[9px] font-black uppercase">
                  <FaGem /> {relic.name}
                </span>
              )}
              {a.title && (
                <motion.button
                  whileHover={{ scale: 1.08, rotate: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    equipTitle(a.title!);
                    onChanged();
                  }}
                  className={`ach-title ${isEquipped ? "equipped" : ""}`}
                  title="Equip this title"
                >
                  {isEquipped && <FaCrown className="mr-1 inline text-[10px]" />}
                  {a.title}
                </motion.button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Unlocked coaches only — click to equip.
function CoachCollection({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => {
    void rev;
    return equippedSkin().id;
  }, [rev]);
  const owned = COACH_SKINS.filter((s) => isSkinUnlocked(s, unlocked));
  return (
    <div className="coach-grid">
      {owned.map((skin) => {
        const isEquipped = skin.id === equipped;
        return (
          <motion.button
            key={skin.id}
            whileHover={{ y: -4, rotate: -1 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => {
              equipSkin(skin.id);
              sfx("toggleOn", 0.4);
              emitCoach({ type: "skin-equipped", name: skin.name });
              onChanged();
            }}
            className={`coach-card ${isEquipped ? "equipped" : ""}`}
            title={isEquipped ? `${skin.name} is your coach` : `Equip ${skin.name}`}
          >
            <CoachPreview skinId={skin.id} size={64} />
            <strong>{skin.name}</strong>
            <span className="coach-req">
              {isEquipped ? (
                <>
                  <FaCrown className="inline text-[9px]" /> Equipped
                </>
              ) : (
                "Tap to equip"
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// Owned avatars — click to wear one.
function AvatarCollection({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const inv = useMemo(() => getInventory(), [rev]);
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-10">
      {inv.avatars.map((id) => {
        const isEquipped = id === inv.avatar;
        return (
          <motion.button
            key={id}
            whileHover={{ y: -3, rotate: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              equipAvatar(id);
              sfx("toggleOn", 0.4);
              onChanged();
            }}
            title={isEquipped ? "Equipped" : "Wear this avatar"}
            className={`relative border-4 border-black bg-white p-1 shadow-neo-sm ${isEquipped ? "!bg-neo-secondary" : ""}`}
          >
            <img src={avatarUrl(id, 80)} alt="Owned avatar" className="h-full w-full" loading="lazy" />
            {isEquipped && (
              <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border-2 border-black bg-neo-ok text-[9px]">
                <FaCheck />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// Relics + potions you carry.
function Satchel({ rev }: { rev: number }) {
  const inv = useMemo(() => getInventory(), [rev]);
  if (inv.relics.length === 0 && inv.potions.length === 0) {
    return <p className="text-sm font-bold uppercase text-black/50">Empty — relics drop from boss/elite chests and achievements; potions come from events and the shop.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {inv.relics.map((id) => {
        const r = relicById(id);
        if (!r) return null;
        return (
          <motion.span
            key={id}
            whileHover={{ y: -3, rotate: -2 }}
            title={r.desc}
            className={`flex items-center gap-1.5 border-4 border-black px-2 py-1 text-[11px] font-black uppercase shadow-neo-sm ${RARITY_BG[r.rarity]}`}
          >
            <FaGem className={r.rarity === "legendary" ? "text-neo-accent" : ""} /> {r.name}
          </motion.span>
        );
      })}
      {inv.potions.map((id, i) => {
        const p = potionById(id);
        if (!p) return null;
        return (
          <motion.span
            key={`${id}-${i}`}
            whileHover={{ y: -3, rotate: 2 }}
            title={p.desc}
            className="flex items-center gap-1.5 border-4 border-black bg-neo-blue px-2 py-1 text-[11px] font-black uppercase text-white shadow-neo-sm"
          >
            <FaFlask /> {p.name}
          </motion.span>
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
  const engine = useMemo(() => currentEngine(), [rev]);
  const rating = engine.rating;
  const rank = RANKS[engine.rankIdx];
  const peak = engine.peakAllTime;
  const streak = useMemo(() => currentStreak(), [rev]);
  const lvl = useMemo(() => levelInfo(), [rev]);
  const avatar = useMemo(() => {
    void rev;
    return ensureAvatar();
  }, [rev]);
  const title = useMemo(() => equippedTitle(), [rev]);

  const seasonLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
  };

  return (
    <div className="analytics">
      {/* Profile hero */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-4 flex flex-wrap items-center gap-4 border-4 border-black bg-white p-4 shadow-neo"
      >
        <motion.img
          key={avatar}
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          src={avatarUrl(avatar, 160)}
          alt="Your avatar"
          className="h-20 w-20 border-4 border-black bg-neo-bg shadow-neo-sm"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black uppercase leading-none tracking-tight">{title}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase"
              style={{ background: rank.color, color: rank.text }}
            >
              {rank.name} · {rating}
            </span>
            <span className="border-2 border-black bg-neo-blue px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
              Level {lvl.level} · {lvl.into}/{lvl.needed} XP
            </span>
          </div>
        </div>
      </motion.div>

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
            {rank.name} · {rating}
          </strong>
          <span>Rank</span>
        </motion.div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="stat">
          <strong>{peak}</strong>
          <span>All-time peak</span>
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
          <h3><FaTrophy className="mr-1 inline text-neo-orange" />Unlocked achievements</h3>
          <p className="dash-sub">Your trophies — click a title to wear it. The full catalog lives in the Shop tab.</p>
          <UnlockedAchievements rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-2">
          <h3><FaUserGroup className="mr-1 inline text-neo-pink" />Coaches</h3>
          <p className="dash-sub">Earned companions — click one to make it yours.</p>
          <CoachCollection rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash">
          <h3><FaGem className="mr-1 inline text-neo-muted" />Satchel</h3>
          <p className="dash-sub">Relics (passive) and potions (one-use, on your map belt).</p>
          <Satchel rev={rev} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaCheck className="mr-1 inline text-neo-ok" />Your avatars</h3>
          <p className="dash-sub">Click one to wear it — buy more in the Shop.</p>
          <AvatarCollection rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaCalendarDays className="mr-1 inline text-neo-blue" />Seasons</h3>
          <p className="dash-sub">
            Every month your rating soft-resets toward 1000 and the climb restarts — season peaks live here forever.
          </p>
          <div className="flex flex-wrap gap-3">
            <motion.div
              whileHover={{ y: -3, rotate: -1 }}
              className="flex flex-col gap-1 border-4 border-black p-3 shadow-neo-sm"
              style={{ background: rank.color, color: rank.text }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Current — {seasonLabel(engine.seasonKey)}
              </span>
              <span className="text-lg font-black uppercase">
                {rank.name} · peak {engine.seasonPeak}
              </span>
            </motion.div>
            {[...engine.seasons].reverse().map((s) => (
              <motion.div
                key={s.key}
                whileHover={{ y: -3, rotate: 1 }}
                className="flex flex-col gap-1 border-4 border-black bg-white p-3 shadow-neo-sm"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-black/60">
                  {seasonLabel(s.key)}
                </span>
                <span className="text-lg font-black uppercase">
                  {RANKS[s.rankIdx].name} · peak {s.peak}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
