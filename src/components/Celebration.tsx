import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FaBolt, FaFire, FaCircleCheck, FaCheckDouble, FaFlag, FaTrophy, FaScroll, FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6";

const COLORS = ["#FF6B6B", "#FFD93D", "#C4B5FD", "#4ADE80", "#4D96FF", "#FF6FB5"];

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
}

interface Particle {
  x: number;
  y: number;
  rotate: number;
  size: number;
  color: string;
  delay: number;
  round: boolean;
}

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 120 + Math.random() * 220;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 60,
      rotate: (Math.random() - 0.5) * 540,
      size: 8 + Math.random() * 10,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.12,
      round: Math.random() > 0.6,
    };
  });
}

const KIND_META = {
  solved: { label: "Solved!", icon: <FaCircleCheck />, bg: "bg-neo-ok" },
  assisted: { label: "Solved (assisted)", icon: <FaCheckDouble />, bg: "bg-neo-muted" },
  logged: { label: "Logged. Come back stronger", icon: <FaFlag />, bg: "bg-neo-secondary" },
} as const;

export function Celebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  const confetti = data.kind !== "logged";
  const particles = useMemo(() => (confetti ? makeParticles(26) : []), [data.seq, confetti]);

  const hasExtras = Boolean(data.achievements?.length || data.questCompleted);
  useEffect(() => {
    const t = setTimeout(onDone, (confetti ? 2000 : 1400) + (hasExtras ? 1200 : 0));
    return () => clearTimeout(t);
  }, [data.seq, confetti, hasExtras, onDone]);

  const meta = KIND_META[data.kind];

  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center overflow-hidden">
      {particles.map((p, i) => (
        <motion.span
          key={`${data.seq}-${i}`}
          className="absolute border-2 border-black"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : 0,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y + 120, opacity: 0, rotate: p.rotate, scale: 0.6 }}
          transition={{ duration: 1.4, delay: p.delay, ease: [0.15, 0.85, 0.4, 1] }}
        />
      ))}

      <motion.div
        key={data.seq}
        initial={{ scale: 0.4, rotate: -10, opacity: 0, y: 20 }}
        animate={{ scale: 1, rotate: -2, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: -16 }}
        transition={{ type: "spring", stiffness: 380, damping: 20 }}
        className={`flex flex-col items-center gap-2 border-4 border-black px-8 py-5 shadow-neo-lg ${meta.bg}`}
      >
        <div className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight md:text-3xl">
          {meta.icon} {meta.label}
        </div>
        <div className="max-w-[280px] truncate text-sm font-bold uppercase tracking-wide text-black/80">
          {data.title}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {confetti && (
            <motion.span
              initial={{ scale: 0, rotate: 12 }}
              animate={{ scale: 1, rotate: -3 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 400, damping: 15 }}
              className="flex items-center gap-1 border-4 border-black bg-white px-2 py-0.5 text-sm font-black shadow-neo-sm"
            >
              <FaBolt className="text-neo-accent" /> {data.elo} elo
            </motion.span>
          )}
          {data.ratingDelta !== undefined && data.ratingDelta !== 0 && (
            <motion.span
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0, rotate: data.ratingDelta > 0 ? -3 : 3 }}
              transition={{ delay: 0.32, type: "spring", stiffness: 400, damping: 14 }}
              className={`flex items-center gap-1 border-4 border-black px-2 py-0.5 text-sm font-black shadow-neo-sm ${
                data.ratingDelta > 0 ? "bg-neo-ok" : "bg-white"
              }`}
            >
              {data.ratingDelta > 0 ? <FaArrowTrendUp /> : <FaArrowTrendDown className="text-neo-accent" />}
              {data.ratingDelta > 0 ? "+" : ""}
              {data.ratingDelta} → {data.ratingAfter}
            </motion.span>
          )}
          {data.streak >= 2 && (
            <motion.span
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 3 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 15 }}
              className="flex items-center gap-1 border-4 border-black bg-white px-2 py-0.5 text-sm font-black shadow-neo-sm"
            >
              <FaFire className="text-neo-orange" /> {data.streak}-day streak
            </motion.span>
          )}
        </div>

        {(data.achievements?.length || data.questCompleted) && (
          <div className="flex flex-col items-center gap-1.5">
            {data.achievements?.map((name, i) => (
              <motion.span
                key={name}
                initial={{ scale: 0, x: -30 }}
                animate={{ scale: 1, x: 0, rotate: i % 2 ? 2 : -2 }}
                transition={{ delay: 0.6 + i * 0.15, type: "spring", stiffness: 380, damping: 14 }}
                className="flex items-center gap-1.5 border-4 border-black bg-neo-secondary px-3 py-1 text-sm font-black uppercase shadow-neo-sm"
              >
                <FaTrophy className="text-neo-orange" /> Unlocked: {name}
              </motion.span>
            ))}
            {data.questCompleted && (
              <motion.span
                initial={{ scale: 0, x: 30 }}
                animate={{ scale: 1, x: 0, rotate: -2 }}
                transition={{ delay: 0.6 + (data.achievements?.length ?? 0) * 0.15, type: "spring", stiffness: 380, damping: 14 }}
                className="flex items-center gap-1.5 border-4 border-black bg-neo-muted px-3 py-1 text-sm font-black uppercase shadow-neo-sm"
              >
                <FaScroll /> Daily quest complete
              </motion.span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
