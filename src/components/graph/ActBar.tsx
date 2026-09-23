// Top-center act switcher: one segment per act with its own progress fill.
import { motion } from "framer-motion";
import { FaLock, FaChevronLeft, FaChevronRight, FaCrown } from "react-icons/fa6";
import { spring } from "../../lib/motion";
import { sfx } from "../../lib/sfx";

export function ActBar({
  viewAct,
  maxAct,
  actProgress,
  overall,
  onViewAct,
}: {
  viewAct: number;
  maxAct: number;
  actProgress: number[]; // 0..1 per act
  overall: number; // 0..100
  onViewAct: (a: number) => void;
}) {
  const go = (a: number) => {
    if (a < 0 || a > maxAct || a === viewAct) return;
    sfx("tab", 0.25);
    onViewAct(a);
  };
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 md:top-4">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring.soft}
        className="pointer-events-auto flex items-stretch border-4 border-black bg-white shadow-neo-sm"
      >
        <button
          onClick={() => go(viewAct - 1)}
          disabled={viewAct === 0}
          aria-label="Previous act ( [ )"
          className="grid w-8 place-items-center border-r-4 border-black hover:enabled:bg-neo-bg disabled:opacity-30"
        >
          <FaChevronLeft className="text-xs" />
        </button>
        {actProgress.map((p, a) => {
          const locked = a > maxAct;
          const active = a === viewAct;
          const done = p >= 1;
          return (
            <button
              key={a}
              onClick={() => go(a)}
              disabled={locked}
              aria-current={active ? "true" : undefined}
              title={locked ? `Act ${a + 1} — clear the boss of act ${a} to unlock` : `Act ${a + 1} · ${Math.round(p * 100)}%`}
              className={`relative flex min-w-[64px] items-center justify-center gap-1 overflow-hidden border-r-4 border-black px-3 py-1.5 text-[11px] font-black uppercase ${
                locked ? "cursor-not-allowed bg-neo-bg text-black/35" : active ? "" : "hover:bg-neo-bg"
              }`}
            >
              {active && <motion.span layoutId="act-seg" transition={spring.snappy} className="absolute inset-0 bg-neo-secondary" />}
              {/* per-act progress fill along the bottom */}
              {!locked && (
                <motion.span
                  className="absolute bottom-0 left-0 h-1.5 bg-neo-accent"
                  initial={false}
                  animate={{ width: `${p * 100}%` }}
                  transition={spring.soft}
                />
              )}
              <span className="relative flex items-center gap-1">
                {locked ? <FaLock className="text-[9px]" /> : done ? <FaCrown className="text-[10px] text-neo-orange" /> : null}
                <span className="hidden sm:inline">Act</span> {a + 1}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => go(viewAct + 1)}
          disabled={viewAct >= maxAct}
          aria-label="Next act ( ] )"
          className="grid w-8 place-items-center hover:enabled:bg-neo-bg disabled:opacity-30"
        >
          <FaChevronRight className="text-xs" />
        </button>
        <span className="hidden items-center border-l-4 border-black bg-black px-2 text-[11px] font-black tabular-nums text-neo-secondary sm:flex" title="Whole-map progress">
          {overall}%
        </span>
      </motion.div>
    </div>
  );
}
