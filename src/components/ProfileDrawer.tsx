// Profile drawer: identity + wallet up top, then Collection / Shop.
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCoins, FaFire, FaTrophy, FaMountain, FaBoxArchive, FaShop, FaCalendarDays } from "react-icons/fa6";
import { Drawer } from "./ui/Drawer";
import { Segmented } from "./ui/Segmented";
import { NumberTicker } from "./ui/NumberTicker";
import { CollectionSection } from "./Collection";
import { ShopSection } from "./ShopView";
import { AccountChip } from "./AuthGate";
import { currentEngine, RANKS } from "../state/rating";
import { levelInfo } from "../state/xp";
import { currentStreak } from "../state/analytics";
import { equippedTitle, unlockedAchievements, ACHIEVEMENTS } from "../state/achievements";
import { getInventory } from "../state/inventory";
import { avatarUrl, ensureAvatar } from "../lib/avatars";
import { pageSwap, spring } from "../lib/motion";

export type ProfileTab = "collection" | "shop";

function seasonLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
}

export function ProfileDrawer({
  open,
  onClose,
  tab,
  onTab,
  rev,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  tab: ProfileTab;
  onTab: (t: ProfileTab) => void;
  rev: number;
  onChanged: () => void;
}) {
  const [local, setLocal] = useState(0);
  const r = rev + local;
  const changed = () => {
    setLocal((n) => n + 1);
    onChanged();
  };
  const engine = useMemo(() => currentEngine(), [r]);
  const rank = RANKS[engine.rankIdx];
  const lvl = useMemo(() => levelInfo(), [r]);
  const streak = useMemo(() => currentStreak(), [r]);
  const title = useMemo(() => equippedTitle(), [r]);
  const coins = useMemo(() => getInventory().coins, [r]);
  const achCount = useMemo(() => unlockedAchievements().size, [r]);
  const avatar = useMemo(() => {
    void r;
    return ensureAvatar();
  }, [r]);

  return (
    <Drawer open={open} onClose={onClose} title="Profile">
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        {/* Hero */}
        <div className="flex flex-wrap items-center gap-4 border-4 border-black bg-white p-4 shadow-neo">
          <motion.img
            key={avatar}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: -3 }}
            transition={spring.bouncy}
            src={avatarUrl(avatar, 160)}
            alt="Your avatar"
            className="h-20 w-20 border-4 border-black bg-neo-bg shadow-neo-sm"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-xl font-black uppercase leading-none tracking-tight">{title}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase"
                style={{ background: rank.color, color: rank.text }}
              >
                {rank.name} · {engine.rating}
              </span>
              <span className="border-2 border-black bg-neo-blue px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                Lv {lvl.level}
              </span>
            </div>
            <div className="h-3 w-full max-w-[260px] border-2 border-black bg-neo-bg" title={`${lvl.into}/${lvl.needed} XP`}>
              <motion.div
                className="h-full bg-neo-blue"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(lvl.progress * 100)}%` }}
                transition={spring.soft}
              />
            </div>
          </div>
          <div className="grid w-full grid-cols-4 gap-2 sm:w-auto">
            {[
              { icon: <FaCoins className="text-neo-orange" />, v: coins, label: "Coins" },
              { icon: <FaFire className="text-neo-orange" />, v: streak, label: "Streak" },
              { icon: <FaMountain className="text-neo-blue" />, v: engine.peakAllTime, label: "Peak" },
              { icon: <FaTrophy className="text-neo-orange" />, v: achCount, label: `/${ACHIEVEMENTS.length}` },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center border-2 border-black bg-neo-bg px-2 py-1">
                <span className="flex items-center gap-1 text-sm font-black">
                  {s.icon}
                  <NumberTicker value={s.v} />
                </span>
                <span className="text-[9px] font-black uppercase text-black/60">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seasons strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <FaCalendarDays className="shrink-0 text-neo-blue" />
          <span
            className="shrink-0 border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-neo-sm"
            style={{ background: rank.color, color: rank.text }}
            title="Every month rating soft-resets toward 1000"
          >
            {seasonLabel(engine.seasonKey)} · peak {engine.seasonPeak}
          </span>
          {[...engine.seasons].reverse().map((s) => (
            <span key={s.key} className="shrink-0 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">
              {seasonLabel(s.key)} · {RANKS[s.rankIdx].name} {s.peak}
            </span>
          ))}
        </div>

        <Segmented
          group="profile"
          value={tab}
          onChange={onTab}
          options={[
            { id: "collection", label: "Collection", icon: <FaBoxArchive /> },
            { id: "shop", label: "Shop", icon: <FaShop /> },
          ]}
        />

        <AnimatePresence mode="wait">
          <motion.div key={tab} variants={pageSwap} initial="hidden" animate="show" exit="exit">
            {tab === "collection" ? (
              <CollectionSection rev={r} onChanged={changed} />
            ) : (
              <ShopSection rev={r} onChanged={changed} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-end">
          <AccountChip />
        </div>
      </div>
    </Drawer>
  );
}
