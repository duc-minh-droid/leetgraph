import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FaTrophy, FaLock, FaCrown, FaUserGroup, FaRankingStar, FaFire, FaCalendarDays, FaCoins, FaShop, FaCheck } from "react-icons/fa6";
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
import { currentEngine, RANKS } from "../state/rating";
import { currentStreak } from "../state/analytics";
import { levelInfo } from "../state/xp";
import { getInventory } from "../state/inventory";
import {
  avatarUrl,
  ensureAvatar,
  equipAvatar,
  shopOffers,
  buyAvatar,
  msUntilRestock,
  type ShopOffer,
} from "../lib/avatars";
import { sfx } from "../lib/sfx";
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

// Rotating avatar shop — same stock for everyone, restocks every 5 minutes.
function AvatarShop({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const offers = useMemo(() => shopOffers(now), [Math.floor(now / (5 * 60 * 1000))]);
  const inv = useMemo(() => getInventory(), [rev, offers]);
  const remaining = msUntilRestock(now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  const buy = (o: ShopOffer) => {
    if (buyAvatar(o)) {
      sfx("chestTake", 0.6);
      equipAvatar(o.id);
      emitCoach({ type: "skin-equipped", name: "a new face" });
    } else {
      sfx("error", 0.4);
    }
    onChanged();
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 border-2 border-black bg-neo-secondary px-2 py-0.5 text-xs font-black tabular-nums shadow-neo-sm">
          <FaCoins /> {inv.coins}
        </span>
        <motion.span
          key={mm}
          className="border-2 border-black bg-black px-2 py-0.5 text-xs font-black tabular-nums text-neo-secondary shadow-neo-sm"
          title="Fresh stock every 5 minutes — same for everyone"
        >
          Restock {mm}:{ss.toString().padStart(2, "0")}
        </motion.span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {offers.map((o, i) => {
          const owned = inv.avatars.includes(o.id);
          const affordable = inv.coins >= o.price;
          return (
            <motion.button
              key={o.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
              whileHover={owned || !affordable ? {} : { y: -4, rotate: i % 2 ? 2 : -2 }}
              whileTap={owned || !affordable ? {} : { scale: 0.93 }}
              disabled={owned || !affordable}
              onClick={() => buy(o)}
              title={owned ? "Already owned" : affordable ? `Buy for ${o.price} coins` : `Need ${o.price - inv.coins} more coins`}
              className={`flex flex-col items-center gap-1.5 border-4 border-black bg-white p-2 shadow-neo-sm ${
                owned ? "opacity-50" : affordable ? "" : "grayscale"
              }`}
            >
              <img src={avatarUrl(o.id, 80)} alt="Avatar for sale" className="h-16 w-16 border-2 border-black bg-neo-bg" loading="lazy" />
              <span className={`flex items-center gap-1 border-2 border-black px-1.5 text-[10px] font-black tabular-nums ${owned ? "bg-neo-ok" : "bg-neo-secondary"}`}>
                {owned ? (
                  <>
                    <FaCheck /> Owned
                  </>
                ) : (
                  <>
                    <FaCoins /> {o.price}
                  </>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// Owned avatars — click to wear one.
function AvatarLocker({ rev, onChanged }: { rev: number; onChanged: () => void }) {
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
          <h3><FaShop className="mr-1 inline text-neo-accent" />Avatar shop</h3>
          <p className="dash-sub">
            Earn coins by solving (crits pay double, bosses +25, quests +20) — stock rotates every 5 minutes.
          </p>
          <AvatarShop rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaCheck className="mr-1 inline text-neo-ok" />Your avatars</h3>
          <p className="dash-sub">Click one to wear it.</p>
          <AvatarLocker rev={rev} onChanged={changed} />
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
