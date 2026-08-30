// Shop tab: rotating avatar stock, potions, and the full achievements catalog
// (every achievement shows its reward — coach skin, relic, and title).
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FaCoins,
  FaShop,
  FaCheck,
  FaTrophy,
  FaLock,
  FaFlask,
  FaGem,
  FaCrown,
  FaUserGroup,
} from "react-icons/fa6";
import { ACHIEVEMENTS, unlockedAchievements, equippedTitle, equipTitle } from "../state/achievements";
import { COACH_SKINS } from "../state/coachSkins";
import { POTIONS, relicForAchievement } from "../state/relics";
import { getInventory } from "../state/inventory";
import {
  avatarUrl,
  shopOffers,
  buyAvatar,
  msUntilRestock,
  equipAvatar,
  POTION_PRICES,
  buyPotion,
  type ShopOffer,
} from "../lib/avatars";
import { sfx } from "../lib/sfx";
import { emitCoach } from "../state/coachBus";
import "../analytics.css";

function AvatarShop({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const windowKey = Math.floor(now / (5 * 60 * 1000));
  const offers = useMemo(() => shopOffers(now), [windowKey]);
  const inv = useMemo(() => getInventory(), [rev, windowKey]);
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

function PotionShop({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const inv = useMemo(() => getInventory(), [rev]);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {POTIONS.map((p) => {
        const price = POTION_PRICES[p.id];
        const affordable = inv.coins >= price;
        const owned = inv.potions.filter((x) => x === p.id).length;
        return (
          <motion.button
            key={p.id}
            whileHover={affordable ? { y: -4, rotate: -1 } : {}}
            whileTap={affordable ? { scale: 0.94 } : {}}
            disabled={!affordable}
            onClick={() => {
              if (buyPotion(p.id)) sfx("potion", 0.55);
              else sfx("error", 0.4);
              onChanged();
            }}
            title={affordable ? `Buy for ${price} coins` : `Need ${price - inv.coins} more coins`}
            className={`flex flex-col items-start gap-1 border-4 border-black bg-white p-3 text-left shadow-neo-sm ${affordable ? "" : "grayscale opacity-70"}`}
          >
            <span className="flex items-center gap-2 text-sm font-black uppercase">
              <FaFlask className="text-neo-blue" /> {p.name}
              {owned > 0 && <span className="border-2 border-black bg-neo-bg px-1 text-[9px]">x{owned}</span>}
            </span>
            <span className="text-[10px] font-bold leading-snug text-black/70">{p.desc}</span>
            <span className="mt-1 flex items-center gap-1 border-2 border-black bg-neo-secondary px-1.5 text-[10px] font-black tabular-nums">
              <FaCoins /> {price}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// Full catalog: every achievement + its reward (coach / relic / title).
function AchievementCatalog({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => equippedTitle(), [rev]);
  return (
    <div className="ach-grid">
      {ACHIEVEMENTS.map((a) => {
        const isUnlocked = unlocked.has(a.id);
        const coach = COACH_SKINS.find((s) => s.achievement === a.id);
        const relic = relicForAchievement(a.id);
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
            <div className="flex flex-wrap items-center gap-1">
              {coach && (
                <span className="flex items-center gap-1 border-2 border-black bg-neo-pink px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                  <FaUserGroup /> Coach: {coach.name}
                </span>
              )}
              {relic && (
                <span className="flex items-center gap-1 border-2 border-black bg-neo-muted px-1.5 py-0.5 text-[9px] font-black uppercase">
                  <FaGem /> Relic: {relic.name}
                </span>
              )}
              {a.title && (
                <motion.button
                  whileHover={isUnlocked ? { scale: 1.08, rotate: -2 } : {}}
                  whileTap={isUnlocked ? { scale: 0.9 } : {}}
                  disabled={!isUnlocked}
                  onClick={() => {
                    equipTitle(a.title!);
                    onChanged();
                  }}
                  className={`ach-title ${isEquipped ? "equipped" : ""}`}
                  title={isUnlocked ? "Equip this title" : "Unlock to equip"}
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

export function ShopView({ onChanged }: { onChanged?: () => void }) {
  const [rev, setRev] = useState(0);
  const changed = () => {
    setRev((r) => r + 1);
    onChanged?.();
  };
  const coins = useMemo(() => getInventory().coins, [rev]);
  const unlockedCount = useMemo(() => unlockedAchievements().size, [rev]);

  return (
    <div className="analytics">
      <div className="stat-row">
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="stat">
          <strong>
            <FaCoins className="mr-1 inline text-neo-orange" />
            {coins}
          </strong>
          <span>Coins</span>
        </motion.div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="stat">
          <strong>
            {unlockedCount}/{ACHIEVEMENTS.length}
          </strong>
          <span>Achievements</span>
        </motion.div>
      </div>

      <div className="dash-grid">
        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaShop className="mr-1 inline text-neo-accent" />Avatar shop</h3>
          <p className="dash-sub">
            Earn coins by solving (crits pay double, bosses +25, quests +20). Stock rotates every 5 minutes — same for everyone, so grab the good ones first.
          </p>
          <AvatarShop rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaFlask className="mr-1 inline text-neo-blue" />Potions</h3>
          <p className="dash-sub">One-use consumables — they land on your belt on the map.</p>
          <PotionShop rev={rev} onChanged={changed} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaTrophy className="mr-1 inline text-neo-orange" />All achievements</h3>
          <p className="dash-sub">
            Every achievement pays out — a coach skin or a relic, plus an equippable title.
          </p>
          <AchievementCatalog rev={rev} onChanged={changed} />
        </motion.section>
      </div>
    </div>
  );
}
