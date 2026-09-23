// Shop (Profile drawer): limited bundles, rotating avatar stock, potions.
// Also exports the achievement catalog, which lives on the Stats tab.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FaCoins,
  FaShop,
  FaCheck,
  FaTrophy,
  FaLock,
  FaFlask,
  FaCrown,
  FaUserGroup,
  FaGift,
} from "react-icons/fa6";
import { ACHIEVEMENTS, unlockedAchievements, equippedTitle, equipTitle } from "../state/achievements";
import { COACH_SKINS } from "../state/coachSkins";
import { POTIONS, relicForAchievement } from "../state/relics";
import { getInventory } from "../state/inventory";
import { ItemTile } from "./ItemTile";
import {
  avatarUrl,
  shopOffers,
  buyAvatar,
  msUntilRestock,
  equipAvatar,
  POTION_PRICES,
  buyPotion,
  bundleOffers,
  buyBundle,
  bundleKey,
  msUntilBundleRestock,
  BUNDLE_WINDOW_MS,
  type ShopOffer,
} from "../lib/avatars";
import { sfx } from "../lib/sfx";
import { emitCoach } from "../state/coachBus";
import "../analytics.css";
import { Section } from "./ui/Section";
import { stagger } from "../lib/motion";
import { burst, pointOf } from "../lib/juice";

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
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
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
              className="flex flex-col items-center gap-1.5 border-4 border-black bg-white p-2 shadow-neo-sm"
              style={{ outline: owned ? "3px solid #4ADE80" : undefined, outlineOffset: "2px" }}
            >
              <img src={avatarUrl(o.id, 80)} alt="Avatar for sale" className="h-16 w-16 border-2 border-black bg-neo-bg" loading="lazy" />
              <span
                className={`flex items-center gap-1 border-2 border-black px-1.5 text-[10px] font-black tabular-nums ${
                  owned ? "bg-neo-ok" : affordable ? "bg-neo-secondary" : "bg-neo-accent text-white"
                }`}
              >
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
            className="flex flex-col items-start gap-1.5 border-4 border-black bg-white p-3 text-left shadow-neo-sm"
          >
            <span className="flex items-center gap-2 text-sm font-black uppercase">
              <ItemTile id={p.id} size="sm" tipSide="top" />
              {p.name}
              {owned > 0 && <span className="border-2 border-black bg-neo-bg px-1 text-[9px]">x{owned}</span>}
            </span>
            <span className="text-[10px] font-bold leading-snug text-black/70">{p.desc}</span>
            <span
              className={`mt-1 flex items-center gap-1 border-2 border-black px-1.5 text-[10px] font-black tabular-nums ${
                affordable ? "bg-neo-secondary" : "bg-neo-accent text-white"
              }`}
              title={affordable ? undefined : `Need ${price - inv.coins} more coins`}
            >
              <FaCoins /> {price}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// Limited bundles: two seeded offers, 30-minute rotation, one purchase each.
function BundleShop({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const windowKey = Math.floor(now / BUNDLE_WINDOW_MS);
  const bundles = useMemo(() => bundleOffers(now), [windowKey]);
  const inv = useMemo(() => getInventory(), [rev, windowKey]);
  const remaining = msUntilBundleRestock(now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span className="-rotate-2 border-2 border-black bg-neo-accent px-2 py-0.5 text-xs font-black uppercase text-white shadow-neo-sm">
          Limited!
        </span>
        <span className="border-2 border-black bg-black px-2 py-0.5 text-xs font-black tabular-nums text-neo-secondary shadow-neo-sm">
          Gone in {mm}:{ss.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {bundles.map((b, i) => {
          const bought = inv.bundlesBought.includes(bundleKey(b, now));
          const relicOwned = Boolean(b.relic && inv.relics.includes(b.relic.id));
          const affordable = inv.coins >= b.price;
          const blocked = bought || relicOwned || !affordable;
          return (
            <motion.button
              key={b.id}
              initial={{ y: 20, opacity: 0, rotate: i % 2 ? 1 : -1 }}
              animate={{ y: 0, opacity: 1 }}
              whileHover={blocked ? {} : { y: -4, rotate: i % 2 ? 2 : -2 }}
              whileTap={blocked ? {} : { scale: 0.95 }}
              disabled={blocked}
              onClick={() => {
                if (buyBundle(b)) sfx("chestTake", 0.65);
                else sfx("error", 0.4);
                onChanged();
              }}
              title={
                bought
                  ? "Already grabbed this one"
                  : relicOwned
                    ? "You already own this relic — wait for the next rotation"
                    : affordable
                      ? `Buy for ${b.price} coins`
                      : `Need ${b.price - inv.coins} more coins`
              }
              className="relative flex w-fit max-w-[280px] flex-col gap-2 self-start border-4 border-black bg-white p-3 text-left shadow-neo"
              style={{
                outline: bought ? "3px solid #4ADE80" : relicOwned ? "3px dashed #C4B5FD" : undefined,
                outlineOffset: "2px",
              }}
            >
              <span className="absolute -right-2 -top-3 rotate-6 border-2 border-black bg-neo-secondary px-1.5 py-0.5 text-[9px] font-black uppercase shadow-neo-sm">
                −{Math.round((1 - b.price / b.fullPrice) * 100)}%
              </span>
              {(bought || relicOwned) && (
                <span
                  className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] border-4 border-black px-3 py-1 text-lg font-black uppercase shadow-neo ${
                    bought ? "bg-neo-ok" : "bg-neo-muted"
                  }`}
                >
                  {bought ? "Grabbed!" : "Relic owned"}
                </span>
              )}
              <span className="flex items-center gap-2 text-base font-black uppercase">
                <FaGift className="text-neo-accent" /> {b.name}
              </span>
              <span className="text-[10px] font-bold uppercase leading-snug text-black/70">{b.desc}</span>
              <span className="flex flex-wrap items-center gap-2">
                {b.avatars.map((a) => (
                  <img key={a} src={avatarUrl(a, 64)} alt="Bundle avatar" className="h-11 w-11 border-2 border-black bg-neo-bg" loading="lazy" />
                ))}
                {b.relic && <ItemTile id={b.relic.id} size="md" tipSide="top" />}
                {b.potions.map((p, j) => (
                  <ItemTile key={`${p}-${j}`} id={p} size="md" tipSide="top" />
                ))}
              </span>
              <span className="flex items-center gap-2 text-sm font-black tabular-nums">
                <span className="text-black/40 line-through">{b.fullPrice}</span>
                <span
                  className={`flex items-center gap-1 border-2 border-black px-2 py-0.5 ${
                    bought ? "bg-neo-ok" : affordable ? "bg-neo-secondary" : "bg-neo-accent text-white"
                  }`}
                >
                  {bought ? (
                    <>
                      <FaCheck /> Grabbed
                    </>
                  ) : (
                    <>
                      <FaCoins /> {b.price}
                    </>
                  )}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// Full catalog: every achievement + its reward (coach / relic / title).
export function AchievementCatalog({ rev, onChanged }: { rev: number; onChanged: () => void }) {
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
              {relic && <ItemTile id={relic.id} size="sm" tipSide="top" tipExtra="Reward relic" />}
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

export function ShopSection({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  return (
    <motion.div
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5"
      onClickCapture={(e) => {
        // Purchase juice: any enabled buy button pops confetti where you clicked.
        const btn = (e.target as HTMLElement).closest("button:not(:disabled)");
        if (btn) {
          const p = pointOf(btn);
          burst(p.x, p.y, { count: 16, speed: 360, colors: ["#FFD93D", "#FF9F45", "#4ADE80"] });
        }
      }}
    >
      <Section icon={<FaGift />} title="Limited bundles" color="accent" sub="Deep discounts, 30-minute rotation, one grab each — the only way to buy relics outright.">
        <BundleShop rev={rev} onChanged={onChanged} />
      </Section>
      <Section icon={<FaShop />} title="Avatar shop" color="yellow" sub="Stock rotates every 5 minutes — same for everyone. Crits pay double, bosses +25, quests +20.">
        <AvatarShop rev={rev} onChanged={onChanged} />
      </Section>
      <Section icon={<FaFlask />} title="Potions" color="blue" sub="One-use consumables — they land on your belt on the map.">
        <PotionShop rev={rev} onChanged={onChanged} />
      </Section>
    </motion.div>
  );
}
