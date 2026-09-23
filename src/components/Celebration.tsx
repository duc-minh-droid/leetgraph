import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBolt,
  FaFire,
  FaCircleCheck,
  FaCheckDouble,
  FaFlag,
  FaTrophy,
  FaScroll,
  FaSkullCrossbones,
  FaHandSparkles,
  FaCoins,
  FaGem,
  FaArrowTrendDown,
  FaBan,
} from "react-icons/fa6";
import { NumberTicker } from "./ui/NumberTicker";
import { burst, pointOf } from "../lib/juice";
import { spring } from "../lib/motion";

export interface CelebrationData {
  kind: "solved" | "assisted" | "logged";
  title: string;
  elo: number;
  streak: number;
  seq: number; // bump to retrigger
  ratingDelta?: number;
  ratingAfter?: number;
  achievements?: string[]; // names of newly unlocked achievements
  questCompleted?: boolean;
  crit?: boolean; // big rating swing or lucky-coin proc
  effectNotes?: string[]; // relic/curse/event effects that fired
  curseGained?: string | null;
  curseCleansed?: string | null;
  combo?: number; // solves today
  promoNote?: string | null; // promo series status line
  rankDown?: string | null; // demoted to this rank
  farmed?: boolean; // farming cutoff hit — no rating earned
  xpEarned?: number;
  levelUp?: number | null; // new level, if this attempt leveled you up
  coinsEarned?: number;
  relicsGained?: string[]; // relics granted by achievement unlocks
}

const KIND_META = {
  solved: { label: "Solved!", icon: <FaCircleCheck />, bg: "bg-neo-ok" },
  assisted: { label: "Solved (assisted)", icon: <FaCheckDouble />, bg: "bg-neo-muted" },
  logged: { label: "Logged — come back stronger", icon: <FaFlag />, bg: "bg-neo-secondary" },
} as const;

interface Chip {
  key: string;
  node: ReactNode;
  cls: string;
}

// Ranked by importance: the first MAX_CHIPS show, the rest fold into "+N".
function chipsOf(d: CelebrationData): Chip[] {
  const c: Chip[] = [];
  d.achievements?.forEach((n) => c.push({ key: `a-${n}`, node: <><FaTrophy className="text-neo-orange" /> {n}</>, cls: "bg-neo-secondary" }));
  d.relicsGained?.forEach((r) => c.push({ key: `r-${r}`, node: <><FaGem /> Relic: {r}</>, cls: "bg-neo-muted" }));
  if (d.rankDown) c.push({ key: "down", node: <><FaArrowTrendDown /> Demoted: {d.rankDown}</>, cls: "bg-neo-accent text-white" });
  if (d.promoNote) c.push({ key: "promo", node: <>{d.promoNote}</>, cls: "bg-black text-neo-secondary" });
  if (d.curseGained) c.push({ key: "curse", node: <><FaSkullCrossbones /> Cursed: {d.curseGained}</>, cls: "bg-black text-neo-accent" });
  if (d.curseCleansed) c.push({ key: "cleanse", node: <><FaHandSparkles /> Cleansed: {d.curseCleansed}</>, cls: "bg-neo-ok" });
  if (d.questCompleted) c.push({ key: "quest", node: <><FaScroll /> Daily quest done</>, cls: "bg-neo-muted" });
  if ((d.xpEarned ?? 0) > 0) c.push({ key: "xp", node: <>+{d.xpEarned} XP</>, cls: "bg-neo-blue text-white" });
  if ((d.coinsEarned ?? 0) > 0) c.push({ key: "coins", node: <><FaCoins /> +{d.coinsEarned}</>, cls: "bg-neo-secondary" });
  if (d.streak >= 2) c.push({ key: "streak", node: <><FaFire className="text-neo-orange" /> {d.streak}-day streak</>, cls: "bg-white" });
  if (d.farmed) c.push({ key: "farm", node: <><FaBan /> Beneath you — no rating</>, cls: "bg-white text-black/60" });
  d.effectNotes?.forEach((n, i) => c.push({ key: `e-${i}`, node: <>{n}</>, cls: "bg-white" }));
  return c;
}

const MAX_CHIPS = 4;

export function Celebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const meta = KIND_META[data.kind];
  const good = data.kind !== "logged";
  const crit = Boolean(data.crit && good);
  const chips = chipsOf(data);
  const shown = expanded ? chips : chips.slice(0, MAX_CHIPS);
  const hidden = chips.length - shown.length;
  const delta = data.ratingDelta ?? 0;

  // Auto-dismiss, longer when there's more to read; paused once expanded.
  useEffect(() => {
    if (expanded) return;
    const t = setTimeout(onDone, (good ? 2200 : 1600) + Math.min(chips.length, 6) * 250);
    return () => clearTimeout(t);
  }, [data.seq, expanded, good, chips.length, onDone]);

  // Space / Enter / Esc skips.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  // Confetti from the card itself once it lands.
  useEffect(() => {
    if (!good) return;
    const t = setTimeout(() => {
      const p = pointOf(cardRef.current);
      burst(p.x, p.y, { count: crit ? 70 : 36, speed: crit ? 900 : 620 });
    }, 120);
    return () => clearTimeout(t);
  }, [data.seq, good, crit]);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center p-4">
      <motion.div
        ref={cardRef}
        key={data.seq}
        initial={{ scale: 0.3, rotate: -12, opacity: 0, y: 30 }}
        animate={{ scale: 1, rotate: -2, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -24, transition: { duration: 0.15 } }}
        transition={spring.slam}
        onClick={() => (hidden > 0 && !expanded ? setExpanded(true) : onDone())}
        className={`pointer-events-auto flex max-w-[92vw] cursor-pointer flex-col items-center gap-2.5 border-4 border-black px-7 py-5 shadow-neo-lg ${meta.bg}`}
      >
        {crit && (
          <motion.div
            initial={{ scale: 3.5, opacity: 0, rotate: 10 }}
            animate={{ scale: 1, opacity: 1, rotate: -3 }}
            transition={{ type: "spring", stiffness: 420, damping: 11 }}
            className="border-4 border-black bg-neo-accent px-4 py-1 text-2xl font-black uppercase tracking-tight text-white shadow-[4px_4px_0_0_#FFD93D] md:text-4xl"
          >
            CRITICAL!
          </motion.div>
        )}

        <div className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight md:text-3xl">
          {meta.icon} {meta.label}
          {(data.combo ?? 0) >= 2 && (
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 6 }}
              transition={{ ...spring.bouncy, delay: 0.25 }}
              className="border-2 border-black bg-neo-orange px-1.5 text-base shadow-neo-sm"
            >
              x{data.combo}
            </motion.span>
          )}
        </div>
        <div className="max-w-[300px] truncate text-xs font-bold uppercase tracking-wide text-black/70">
          {data.title} · <FaBolt className="inline text-[10px]" /> {data.elo}
        </div>

        {/* Headline number: rating delta ticker */}
        {delta !== 0 && data.ratingAfter !== undefined && (
          <motion.div
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ ...spring.bouncy, delay: 0.2 }}
            className={`flex items-center gap-2 border-4 border-black px-3 py-1 text-xl font-black shadow-neo-sm ${
              delta > 0 ? "bg-white" : "bg-black text-white"
            }`}
          >
            <span className={delta > 0 ? "text-green-600" : "text-neo-accent"}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
            <span className="text-black/30">→</span>
            <NumberTicker value={data.ratingAfter} />
          </motion.div>
        )}

        {data.levelUp && (
          <motion.span
            initial={{ scale: 3, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 2 }}
            transition={{ ...spring.slam, delay: 0.4 }}
            className="border-4 border-black bg-neo-blue px-4 py-1 text-lg font-black uppercase text-white shadow-[4px_4px_0_0_#000]"
          >
            Level up → {data.levelUp}
          </motion.span>
        )}

        {chips.length > 0 && (
          <div className="flex max-w-[340px] flex-wrap items-center justify-center gap-1.5">
            <AnimatePresence initial>
              {shown.map((c, i) => (
                <motion.span
                  key={c.key}
                  initial={{ scale: 0, y: 8 }}
                  animate={{ scale: 1, y: 0, rotate: i % 2 ? 1.5 : -1.5 }}
                  transition={{ ...spring.bouncy, delay: expanded ? i * 0.03 : 0.35 + i * 0.08 }}
                  className={`flex items-center gap-1 border-2 border-black px-2 py-0.5 text-[11px] font-black uppercase shadow-neo-sm ${c.cls}`}
                >
                  {c.node}
                </motion.span>
              ))}
            </AnimatePresence>
            {hidden > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 }}
                className="border-2 border-dashed border-black bg-white/70 px-2 py-0.5 text-[11px] font-black uppercase"
              >
                +{hidden} more
              </motion.span>
            )}
          </div>
        )}
        <span className="text-[9px] font-black uppercase tracking-widest text-black/40">
          {hidden > 0 && !expanded ? "tap for more · space to skip" : "tap or space to continue"}
        </span>
      </motion.div>
    </div>
  );
}
