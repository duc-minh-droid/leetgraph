// Right-edge dock: one rail, one open panel at a time — Quests or Rematches.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaScroll, FaKhanda, FaCoins, FaCheck, FaSun, FaXmark } from "react-icons/fa6";
import { getBoard, boardStatus, claimQuest, refreshBoardAI } from "../../state/questBoard";
import { todaysQuest } from "../../state/quests";
import type { ReviewItem } from "../../state/reviews";
import type { Problem } from "../../data/problems";
import { emitCoach } from "../../state/coachBus";
import { sfx } from "../../lib/sfx";
import { flyTo, burst, pointOf } from "../../lib/juice";
import { spring } from "../../lib/motion";

type Pane = "quests" | "rematches" | null;

function RailButton({
  active,
  onClick,
  icon,
  badge,
  label,
  hot,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  badge: number;
  label: string;
  hot: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      aria-expanded={active}
      title={label}
      whileHover={{ x: -3 }}
      whileTap={{ scale: 0.9 }}
      className={`relative grid h-11 w-11 place-items-center border-b-4 border-black text-base last:border-b-0 ${
        active ? "bg-neo-accent" : "bg-white hover:bg-neo-bg"
      }`}
    >
      <span className={hot && !active ? "node-bob" : ""}>{icon}</span>
      {badge > 0 && (
        <motion.span
          key={badge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring.bouncy}
          className={`absolute -left-2 -top-2 grid h-5 min-w-5 place-items-center border-2 border-black px-1 text-[10px] font-black ${
            hot ? "bg-neo-accent text-white" : "bg-neo-secondary"
          }`}
        >
          {badge}
        </motion.span>
      )}
    </motion.button>
  );
}

function QuestsPane({ rev, onClaim }: { rev: number; onClaim: () => void }) {
  const [board, setBoard] = useState(() => getBoard());
  const status = useMemo(() => {
    void rev;
    void board;
    return boardStatus();
  }, [rev, board]);
  const daily = useMemo(() => {
    void rev;
    return todaysQuest();
  }, [rev]);
  useEffect(() => {
    void refreshBoardAI().then((b) => b && setBoard(b));
  }, []);

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className={`flex items-center gap-2 border-4 border-black p-2 ${daily.done ? "bg-neo-ok" : "bg-neo-bg"}`}>
        <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-black bg-white">
          {daily.done ? <FaCheck /> : <FaSun className="text-neo-orange" />}
        </span>
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-black/50">Daily quest</div>
          <div className="text-[11px] font-black uppercase leading-tight">{daily.label}</div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 text-[9px] font-black uppercase tracking-widest text-black/50">
        <span>Quest board</span>
        <span className="border-2 border-black bg-white px-1 text-black">{board.ai ? "By the Quest Master" : "Standard issue"}</span>
      </div>
      {status.map((s, i) => (
        <motion.div
          key={i}
          layout
          className={`flex flex-col gap-1.5 border-2 border-black p-2 ${
            s.claimed ? "bg-neo-bg opacity-55" : s.done ? "bg-neo-ok/40" : "bg-white"
          }`}
        >
          <span className="text-[11px] font-black uppercase leading-tight">{s.quest.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1 border-2 border-black bg-neo-bg">
              <motion.div
                className="h-full bg-neo-blue"
                initial={false}
                animate={{ width: `${Math.min(100, (s.progress / s.quest.count) * 100)}%` }}
                transition={spring.soft}
              />
            </div>
            <span className="text-[10px] font-black tabular-nums">
              {s.progress}/{s.quest.count}
            </span>
            {s.claimed ? (
              <span className="border-2 border-black bg-neo-bg px-1.5 py-0.5 text-[9px] font-black uppercase">Claimed</span>
            ) : (
              <motion.button
                whileHover={s.done ? { scale: 1.08 } : {}}
                whileTap={s.done ? { scale: 0.88 } : {}}
                animate={s.done ? { rotate: [0, -4, 4, 0] } : {}}
                transition={s.done ? { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 } : {}}
                disabled={!s.done}
                onClick={(e) => {
                  const from = e.currentTarget;
                  const coins = claimQuest(i);
                  if (coins !== null) {
                    sfx("coinFlip", 0.6);
                    const p = pointOf(from);
                    burst(p.x, p.y, { count: 14, speed: 300, colors: ["#FFD93D", "#FF9F45"] });
                    flyTo(from, "#hud-coins", { html: "¢", count: Math.min(8, Math.ceil(coins / 5)) });
                    emitCoach({ type: "run-ok" });
                  }
                  onClaim();
                }}
                className={`flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-[9px] font-black uppercase shadow-neo-sm ${
                  s.done ? "bg-neo-secondary" : "bg-white opacity-50"
                }`}
              >
                <FaCoins /> {s.quest.reward}
              </motion.button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function RematchPane({
  due,
  problems,
  onPick,
}: {
  due: ReviewItem[];
  problems: Record<string, Problem>;
  onPick: (slug: string) => void;
}) {
  if (due.length === 0) {
    return <p className="p-4 text-[11px] font-black uppercase text-black/50">Nothing due. Failed problems come back here on a 1/3/7/14-day rhythm.</p>;
  }
  return (
    <div className="flex flex-col">
      {due.map((r, i) => {
        const p = problems[r.slug];
        return (
          <motion.button
            key={r.slug}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ x: -4 }}
            onClick={() => onPick(r.slug)}
            className="flex w-full items-center justify-between gap-2 border-b-2 border-black px-3 py-2 text-left last:border-b-0 hover:bg-neo-bg"
          >
            <div className="min-w-0">
              <div className="truncate text-[11px] font-black uppercase">{p?.title ?? r.slug}</div>
              <div className="text-[9px] font-bold uppercase text-black/55">
                {p?.elo ?? "?"} elo · last {r.lastResult.replace(/_/g, " ")}
                {r.overdueDays > 0 ? ` · ${r.overdueDays}d overdue` : " · due today"}
              </div>
            </div>
            <FaKhanda className="shrink-0 text-neo-accent" />
          </motion.button>
        );
      })}
    </div>
  );
}

export function RunDock({
  rev,
  due,
  problems,
  onClaim,
  onPickRematch,
}: {
  rev: number;
  due: ReviewItem[];
  problems: Record<string, Problem>;
  onClaim: () => void;
  onPickRematch: (slug: string) => void;
}) {
  const [pane, setPane] = useState<Pane>(null);
  const claimable = useMemo(() => {
    void rev;
    return boardStatus().filter((s) => s.done && !s.claimed).length;
  }, [rev]);
  const toggle = (p: Pane) => setPane((cur) => (cur === p ? null : p));

  return (
    <div className="pointer-events-none absolute right-3 top-16 z-20 flex items-start gap-2 md:right-4 md:top-4">
      <AnimatePresence>
        {pane && (
          <motion.div
            key={pane}
            initial={{ x: 30, opacity: 0, scale: 0.96 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 30, opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={spring.snappy}
            className="pointer-events-auto flex max-h-[min(70vh,560px)] w-[min(20rem,calc(100vw-5.5rem))] flex-col overflow-hidden border-4 border-black bg-white shadow-neo"
          >
            <div className="flex items-center justify-between border-b-4 border-black bg-neo-secondary px-3 py-1.5 text-xs font-black uppercase">
              <span className="flex items-center gap-1.5">
                {pane === "quests" ? (
                  <>
                    <FaScroll /> Quests
                  </>
                ) : (
                  <>
                    <FaKhanda /> Rematches · beat them this time
                  </>
                )}
              </span>
              <button onClick={() => setPane(null)} aria-label="Close" className="grid h-6 w-6 place-items-center border-2 border-black bg-white hover:bg-neo-accent">
                <FaXmark className="text-[10px]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {pane === "quests" ? (
                <QuestsPane rev={rev} onClaim={onClaim} />
              ) : (
                <RematchPane
                  due={due}
                  problems={problems}
                  onPick={(slug) => {
                    setPane(null);
                    onPickRematch(slug);
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto flex flex-col border-4 border-black bg-white shadow-neo-sm">
        <RailButton
          active={pane === "quests"}
          onClick={() => toggle("quests")}
          icon={<FaScroll />}
          badge={claimable}
          hot={claimable > 0}
          label="Quests"
        />
        <RailButton
          active={pane === "rematches"}
          onClick={() => toggle("rematches")}
          icon={<FaKhanda />}
          badge={due.length}
          hot={due.length > 0}
          label="Rematches"
        />
      </div>
    </div>
  );
}
