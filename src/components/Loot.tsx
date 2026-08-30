import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaGift,
  FaSkullCrossbones,
  FaFlask,
  FaGem,
  FaQuestion,
  FaCoins,
  FaBoxOpen,
  FaDiceD20,
} from "react-icons/fa6";
import { getInventory, updateInventory, type Inventory } from "../state/inventory";
import { eventFor, resolveEvent, type EventResolution } from "../state/events";
import { draftRelics, relicById, curseById, potionById, type RelicDef, type Rarity } from "../state/relics";
import { RANKS, type Rank } from "../state/rating";
import { emitCoach } from "../state/coachBus";

const RANKS_LOOKUP: Record<string, Rank> = Object.fromEntries(RANKS.map((r) => [r.name, r]));

const RARITY_STYLE: Record<Rarity, string> = {
  common: "bg-white",
  rare: "bg-neo-muted",
  legendary: "bg-neo-secondary",
};
const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  legendary: "LEGENDARY",
};

// ---------------- Mystery event modal ----------------
export function EventModal({
  slug,
  onProceed,
  onClose,
}: {
  slug: string;
  onProceed: (blind: boolean) => void;
  onClose: () => void;
}) {
  const ev = eventFor(slug);
  const [result, setResult] = useState<EventResolution | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ rotateY: 90, scale: 0.7 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="w-full max-w-sm border-4 border-black bg-neo-bg shadow-neo-lg"
      >
        <div className="flex items-center gap-2 border-b-4 border-black bg-neo-pink px-4 py-3 text-white">
          <FaDiceD20 className="text-xl" />
          <span className="text-lg font-black uppercase tracking-tight">{ev.title}</span>
        </div>
        <div className="flex flex-col items-center gap-4 p-5">
          <motion.div
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="grid h-20 w-20 place-items-center border-4 border-black bg-black text-4xl text-neo-secondary shadow-neo"
          >
            <FaQuestion />
          </motion.div>
          <p className="text-center text-sm font-bold">{ev.desc}</p>

          {result ? (
            <>
              <motion.p
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className={`border-4 border-black px-3 py-2 text-center text-sm font-black uppercase shadow-neo-sm ${
                  result.coinResult === "tails" ? "bg-neo-accent text-white" : "bg-neo-ok"
                }`}
              >
                {result.message}
              </motion.p>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => onProceed(result.blind)}
                className="neo-btn w-full !py-2.5 text-sm"
              >
                {result.blind ? "Face it blind" : "On to the problem"}
              </motion.button>
            </>
          ) : (
            <div className="flex w-full gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={onClose}
                className="neo-btn neo-btn-ghost flex-1 !py-2.5 text-sm"
              >
                Walk away
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04, rotate: -1 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  const r = resolveEvent(slug);
                  setResult(r);
                  emitCoach({ type: r.coinResult === "tails" ? "failed" : "opened", title: ev.title });
                }}
                className="neo-btn flex-1 !py-2.5 text-sm"
              >
                <FaDiceD20 /> Roll it
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------- Chest / relic draft ----------------
export function ChestModal({ onDone }: { onDone: (relic: RelicDef | null) => void }) {
  const chest = getInventory().pendingChest;
  const [open, setOpen] = useState(false);
  const [choices] = useState<RelicDef[]>(() => (chest ? draftRelics(chest.seed) : []));

  const take = (relic: RelicDef | null) => {
    updateInventory((inv) => ({
      pendingChest: null,
      relics: relic ? [...inv.relics, relic.id] : inv.relics,
      pendingBonus: relic ? inv.pendingBonus : inv.pendingBonus + 10, // empty pool consolation
    }));
    onDone(relic);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4"
    >
      {!open ? (
        <motion.button
          initial={{ y: -200, rotate: -8 }}
          animate={{ y: 0, rotate: [-3, 3, -3] }}
          transition={{ y: { type: "spring", stiffness: 260, damping: 14 }, rotate: { duration: 0.5, repeat: Infinity } }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-3 border-4 border-black bg-neo-secondary p-8 shadow-neo-lg"
        >
          <FaGift className="text-6xl" />
          <span className="text-lg font-black uppercase">Tap to open!</span>
        </motion.button>
      ) : (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="w-full max-w-lg border-4 border-black bg-neo-bg p-4 shadow-neo-lg"
        >
          <div className="mb-3 flex items-center gap-2 text-lg font-black uppercase">
            <FaBoxOpen className="text-neo-orange" /> Pick your relic
          </div>
          {choices.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm font-bold">You own every relic! Have +10 rating instead.</p>
              <button onClick={() => take(null)} className="neo-btn !py-2 text-sm">
                <FaCoins /> Take it
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {choices.map((r, i) => (
                <motion.button
                  key={r.id}
                  initial={{ y: 30, opacity: 0, rotateY: 90 }}
                  animate={{ y: 0, opacity: 1, rotateY: 0 }}
                  transition={{ delay: 0.15 + i * 0.15, type: "spring", stiffness: 240, damping: 18 }}
                  whileHover={{ y: -6, rotate: i === 1 ? 0 : i === 0 ? -2 : 2 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => take(r)}
                  className={`flex flex-col items-center gap-2 border-4 border-black p-3 text-center shadow-neo-sm ${RARITY_STYLE[r.rarity]}`}
                >
                  <FaGem className={r.rarity === "legendary" ? "text-2xl text-neo-accent" : "text-2xl"} />
                  <span className="text-sm font-black uppercase leading-tight">{r.name}</span>
                  <span className="text-[10px] font-bold leading-snug text-black/70">{r.desc}</span>
                  <span className={`border-2 border-black px-1.5 text-[9px] font-black uppercase ${r.rarity === "legendary" ? "bg-black text-neo-secondary" : "bg-white"}`}>
                    {RARITY_LABEL[r.rarity]}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------- Boss intro ----------------
export function BossIntro({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => setTimeout(onDone, 1400)}
      className="absolute inset-0 z-40 grid place-items-center bg-black/80"
    >
      <div className="flex flex-col items-center gap-3">
        <motion.div
          initial={{ scale: 3, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          className="border-4 border-black bg-neo-accent px-8 py-4 shadow-[8px_8px_0_0_#FFD93D]"
        >
          <span className="flex items-center gap-3 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
            <FaSkullCrossbones /> BOSS
          </span>
        </motion.div>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-[80vw] border-2 border-neo-secondary bg-black px-4 py-2 text-center text-sm font-black uppercase text-neo-secondary"
        >
          {title} — clear it to breach the next act
        </motion.p>
      </div>
    </motion.div>
  );
}

// ---------------- Rank-up ceremony ----------------
export function RankUpCeremony({ rankName, onDone }: { rankName: string; onDone: () => void }) {
  const rank = RANKS_LOOKUP[rankName];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => setTimeout(onDone, 2000)}
      className="absolute inset-0 z-50 grid place-items-center bg-black/85"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.span
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-sm font-black uppercase tracking-[0.3em] text-white"
        >
          Promotion earned
        </motion.span>
        <motion.div
          initial={{ scale: 4, opacity: 0, rotate: 12 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
          className="border-4 border-black px-10 py-5 shadow-[10px_10px_0_0_#000]"
          style={{ background: rank?.color ?? "#FFD93D", color: rank?.text ?? "#000" }}
        >
          <span className="text-4xl font-black uppercase tracking-tight md:text-6xl">{rankName}</span>
        </motion.div>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -6, 6, 0] }}
          transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 12 }}
          className="border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase shadow-neo-sm"
        >
          Defend it. Decay is watching.
        </motion.span>
      </div>
    </motion.div>
  );
}

// ---------------- Belt: relics, potions, curse ----------------
export function Belt({ inv, onChanged }: { inv: Inventory; onChanged: () => void }) {
  const curse = inv.curse ? curseById(inv.curse) : null;
  const usePotion = (idx: number) => {
    const id = inv.potions[idx];
    if (id === "quest-reroll") {
      const d = new Date();
      const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      updateInventory((i) => {
        const potions = [...i.potions];
        potions.splice(idx, 1);
        return { potions, questRerolls: { ...i.questRerolls, [day]: (i.questRerolls[day] ?? 0) + 1 } };
      });
      emitCoach({ type: "opened", title: "a fresh quest" });
    } else if (id === "small-tonic") {
      updateInventory((i) => {
        const potions = [...i.potions];
        potions.splice(idx, 1);
        return { potions, pendingBonus: i.pendingBonus + 10 };
      });
      emitCoach({ type: "run-ok" });
    }
    // second-chance is armed from the report panel, not here.
    onChanged();
  };

  if (inv.relics.length === 0 && inv.potions.length === 0 && !curse && inv.pendingBonus === 0) return null;

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[70%] flex-wrap items-center gap-1.5 md:left-4 md:top-4">
      {inv.relics.map((id) => {
        const r = relicById(id);
        if (!r) return null;
        return (
          <motion.span
            key={id}
            whileHover={{ y: -3, rotate: -3, scale: 1.15 }}
            title={`${r.name} — ${r.desc}`}
            className={`pointer-events-auto grid h-8 w-8 place-items-center border-2 border-black text-sm shadow-neo-sm ${RARITY_STYLE[r.rarity]}`}
          >
            <FaGem className={r.rarity === "legendary" ? "text-neo-accent" : ""} />
          </motion.span>
        );
      })}
      {inv.potions.map((id, i) => {
        const p = potionById(id);
        if (!p) return null;
        return (
          <motion.button
            key={`${id}-${i}`}
            whileHover={{ y: -3, scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => usePotion(i)}
            title={`${p.name} — ${p.desc}${id === "second-chance" ? " (arm it inside the report panel)" : " Click to use."}`}
            className="pointer-events-auto grid h-8 w-8 place-items-center border-2 border-black bg-neo-blue text-sm text-white shadow-neo-sm"
          >
            <FaFlask />
          </motion.button>
        );
      })}
      {inv.pendingBonus !== 0 && (
        <motion.span
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          title="Armed event bonus — applies to your next attempt"
          className={`pointer-events-auto border-2 border-black px-1.5 py-1 text-[10px] font-black shadow-neo-sm ${
            inv.pendingBonus > 0 ? "bg-neo-ok" : "bg-neo-accent text-white"
          }`}
        >
          {inv.pendingBonus > 0 ? "+" : ""}
          {inv.pendingBonus} next
        </motion.span>
      )}
      {curse && (
        <motion.span
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          title={`${curse.name} — ${curse.desc} ${curse.cleanse}`}
          className="pointer-events-auto flex items-center gap-1 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase text-neo-accent shadow-neo-sm"
        >
          <FaSkullCrossbones /> {curse.name}
        </motion.span>
      )}
    </div>
  );
}
