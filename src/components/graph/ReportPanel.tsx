// Attempt report: quick log (result + submit) up front, details tucked away.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import {
  FaBolt,
  FaCircleCheck,
  FaCheckDouble,
  FaXmark,
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaRegClock,
  FaCode,
  FaLightbulb,
  FaRobot,
  FaPenToSquare,
  FaPaperPlane,
  FaShieldHalved,
  FaQuestion,
  FaBan,
  FaChevronDown,
  FaSliders,
} from "react-icons/fa6";
import type { Problem } from "../../data/problems";
import type { Attempt, AttemptResult, FailureMode } from "../../state/attempts";
import { modifierOf, MODIFIER_META } from "../../state/modifiers";
import { effectiveTimedLimit } from "../../state/relics";
import { currentRating, farmCutoff } from "../../state/rating";
import { useIsMobile } from "../../lib/useMedia";
import { spring } from "../../lib/motion";
import { MODIFIER_BG, MODIFIER_ICON, DIFF_HEX } from "./SquareNode";

const DETAILS_KEY = "leetgraph.reportDetails";

const RESULTS: { val: AttemptResult; label: string; cls: string; icon: ReactNode; key: string }[] = [
  { val: "solved", label: "Solved", cls: "bg-neo-ok", icon: <FaCircleCheck />, key: "1" },
  { val: "solved_with_help", label: "With help", cls: "bg-neo-muted", icon: <FaCheckDouble />, key: "2" },
  { val: "gave_up", label: "Gave up", cls: "bg-neo-accent", icon: <FaXmark />, key: "3" },
  { val: "abandoned", label: "Abandoned", cls: "bg-neo-secondary", icon: <FaArrowRight />, key: "4" },
];

function fmtClock(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const REPORT_W = 400;

export function ReportPanel({
  problem,
  startTime,
  blind = false,
  canSecondChance = false,
  onClose,
  onSubmit,
}: {
  problem: Problem;
  startTime: number;
  blind?: boolean;
  canSecondChance?: boolean;
  onClose: () => void;
  onSubmit: (a: Attempt, opts: { secondChance: boolean }) => void;
}) {
  const mobile = useIsMobile();
  const drag = useDragControls();
  const modifier = modifierOf(problem.slug);
  const [secondChance, setSecondChance] = useState(false);
  const beneathYou = useMemo(() => !blind && problem.elo < currentRating() - farmCutoff(), [problem.elo, blind]);
  const [result, setResult] = useState<AttemptResult>("solved");
  const [readTime, setReadTime] = useState(0);
  const [writeTime, setWriteTime] = useState(0);
  const [debugTime, setDebugTime] = useState(0);
  const [timesTouched, setTimesTouched] = useState(false);
  const [hints, setHints] = useState(false);
  const [ai, setAi] = useState(false);
  const [verified, setVerified] = useState(false);
  const [failureMode, setFailureMode] = useState<FailureMode | "">("");
  const [timeComplexity, setTimeComplexity] = useState("");
  const [spaceComplexity, setSpaceComplexity] = useState("");
  const [optimal, setOptimal] = useState(false);
  const [note, setNote] = useState("");
  const [details, setDetails] = useState(() => {
    try {
      return localStorage.getItem(DETAILS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleDetails = () => {
    setDetails((d) => {
      try {
        localStorage.setItem(DETAILS_KEY, d ? "0" : "1");
      } catch {
        /* storage blocked */
      }
      return !d;
    });
  };

  // Live session clock — becomes the write time unless you log phases yourself.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  const total = timesTouched ? readTime + writeTime + debugTime : elapsed;
  const isFailure = result !== "solved" && result !== "solved_with_help";

  const submit = () =>
    onSubmit(
      {
        result,
        time: total,
        hints,
        ai,
        verified,
        note,
        at: Date.now(),
        readTime: timesTouched ? readTime : 0,
        writeTime: timesTouched ? writeTime : elapsed,
        debugTime: timesTouched ? debugTime : 0,
        failureMode: isFailure ? failureMode || null : null,
        timeComplexity,
        spaceComplexity,
        optimal,
      },
      { secondChance }
    );

  // Keyboard: 1–4 pick result, Ctrl/⌘+Enter submits, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (e.key === "Escape") onClose();
      else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
      else if (!typing) {
        const r = RESULTS.find((x) => x.key === e.key);
        if (r) setResult(r.val);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const numInput = (label: string, v: number, set: (n: number) => void) => (
    <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
      {label}
      <input
        type="number"
        min={0}
        className="neo-input !py-1.5 text-center"
        value={v}
        onChange={(e) => {
          if (!timesTouched) {
            setTimesTouched(true);
            if (set !== setWriteTime) setWriteTime(elapsed);
          }
          set(Number(e.target.value));
        }}
      />
    </label>
  );

  const body = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b-4 border-black bg-white p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-lg font-black uppercase leading-tight tracking-tight">
            {blind ? (
              <>
                <FaQuestion className="shrink-0 text-neo-pink" /> ??? Mystery
              </>
            ) : (
              <span className="line-clamp-2">{problem.title}</span>
            )}
          </div>
          {!blind ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase"
                style={{ background: DIFF_HEX[problem.difficulty] ?? "#FFD93D" }}
              >
                {problem.difficulty}
              </span>
              <span className="flex items-stretch border-2 border-black bg-black">
                <span className="grid place-items-center bg-neo-secondary px-1">
                  <FaBolt className="text-[9px]" />
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-black text-white">{problem.elo}</span>
              </span>
              <span className="truncate text-[10px] font-bold uppercase text-black/60">{problem.topics.slice(0, 3).join(" · ")}</span>
            </div>
          ) : (
            <p className="mt-1 text-[10px] font-bold uppercase text-black/60">Title, elo and topics hidden — solve blind for the bounty.</p>
          )}
        </div>
        <motion.button
          onClick={onClose}
          aria-label="Close report panel"
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.85 }}
          className="grid h-9 w-9 shrink-0 place-items-center border-4 border-black bg-white shadow-neo-sm hover:bg-neo-accent"
        >
          <FaXmark />
        </motion.button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex gap-2">
          <motion.a
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="neo-btn neo-btn-yellow flex-1 !py-2.5"
            href={problem.link}
            target="_blank"
            rel="noreferrer"
          >
            <FaArrowUpRightFromSquare /> Open problem
          </motion.a>
          <div
            className="flex flex-col items-center justify-center border-4 border-black bg-black px-3 text-neo-secondary shadow-neo-sm"
            title="Time since you opened this node"
          >
            <FaRegClock className="text-[10px]" />
            <span className="text-sm font-black tabular-nums">{fmtClock(elapsed)}</span>
          </div>
        </div>

        {/* Conditions strip */}
        {(modifier || beneathYou || canSecondChance) && (
          <div className="flex flex-col gap-1.5">
            {modifier && (
              <div className={`flex items-center gap-2 border-2 border-black px-2 py-1.5 text-[10px] font-black uppercase ${MODIFIER_BG[modifier]}`}>
                {MODIFIER_ICON[modifier]}
                <span>
                  {MODIFIER_META[modifier].label} — {MODIFIER_META[modifier].desc}
                  {modifier === "timed" && ` Limit ${Math.round(effectiveTimedLimit(problem.slug, problem.difficulty) / 60)}m.`}
                </span>
              </div>
            )}
            {beneathYou && (
              <div className="flex items-center gap-2 border-2 border-black bg-white px-2 py-1.5 text-[10px] font-black uppercase text-black/60">
                <FaBan /> Beneath you — {farmCutoff()}+ under your rating, no rating payout.
              </div>
            )}
            {canSecondChance && (
              <button
                type="button"
                onClick={() => setSecondChance((s) => !s)}
                aria-pressed={secondChance}
                className={`flex items-center gap-2 border-2 border-black px-2 py-1.5 text-left text-[10px] font-black uppercase transition-colors ${
                  secondChance ? "bg-neo-blue text-white" : "bg-white text-black/60 hover:text-black"
                }`}
              >
                <FaShieldHalved />
                {secondChance ? "Second Chance ARMED — a fail costs nothing" : "Arm Second Chance (fail = no rating loss)"}
              </button>
            )}
          </div>
        )}

        {/* Result */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Result">
          {RESULTS.map((o) => {
            const on = result === o.val;
            return (
              <motion.button
                key={o.val}
                type="button"
                role="radio"
                aria-checked={on}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.93 }}
                animate={on ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ duration: 0.25 }}
                onClick={() => setResult(o.val)}
                className={`relative flex items-center justify-center gap-1.5 border-4 border-black px-2 py-3 text-xs font-black uppercase transition-colors ${
                  on ? `${o.cls} shadow-neo-sm` : "bg-white text-black/50 hover:bg-neo-bg hover:text-black"
                }`}
              >
                {o.icon} {o.label}
                <span className="absolute right-1 top-0.5 text-[8px] opacity-40">{o.key}</span>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {isFailure && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-1.5 overflow-hidden"
            >
              {(
                [
                  { val: "wrong-answer", label: "Wrong answer" },
                  { val: "tle", label: "TLE" },
                  { val: "runtime-error", label: "Runtime err" },
                  { val: "compile-error", label: "Compile err" },
                ] as { val: FailureMode; label: string }[]
              ).map((o) => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => setFailureMode(failureMode === o.val ? "" : o.val)}
                  aria-pressed={failureMode === o.val}
                  className={`border-2 border-black px-2 py-1 text-[10px] font-black uppercase ${
                    failureMode === o.val ? "bg-neo-accent" : "bg-white text-black/60 hover:text-black"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick toggles */}
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { label: "Hints", val: hints, set: setHints, icon: <FaLightbulb /> },
              { label: "AI", val: ai, set: setAi, icon: <FaRobot /> },
              { label: "Verified", val: verified, set: setVerified, icon: <FaShieldHalved /> },
            ] as { label: string; val: boolean; set: (b: boolean) => void; icon: ReactNode }[]
          ).map(({ label, val, set, icon }) => (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => set(!val)}
              aria-pressed={val}
              className={`flex items-center justify-center gap-1.5 border-2 border-black px-2 py-2 text-[10px] font-black uppercase transition-colors ${
                val ? "bg-neo-secondary shadow-neo-sm" : "bg-white text-black/50 hover:text-black"
              }`}
            >
              {icon} {label}
            </motion.button>
          ))}
        </div>

        {/* Details accordion */}
        <div className="border-4 border-black bg-white">
          <button
            type="button"
            onClick={toggleDetails}
            aria-expanded={details}
            className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-black uppercase hover:bg-neo-bg"
          >
            <span className="flex items-center gap-1.5">
              <FaSliders /> Details <span className="font-bold text-black/40">time · complexity · note</span>
            </span>
            <motion.span animate={{ rotate: details ? 180 : 0 }}>
              <FaChevronDown />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {details && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={spring.snappy}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 border-t-4 border-black p-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase">
                      <span className="flex items-center gap-1">
                        <FaRegClock className="text-neo-blue" /> Time by phase (s)
                      </span>
                      <span className="text-black/50">
                        Total {total}s{timesTouched ? "" : " (auto)"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {numInput("Read", readTime, setReadTime)}
                      {numInput("Write", timesTouched ? writeTime : elapsed, setWriteTime)}
                      {numInput("Debug", debugTime, setDebugTime)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase">
                      <FaCode className="text-neo-muted" /> Complexity
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Time O(n)"
                        className="neo-input !py-1.5 text-sm"
                        value={timeComplexity}
                        onChange={(e) => setTimeComplexity(e.target.value)}
                      />
                      <input
                        placeholder="Space O(1)"
                        className="neo-input !py-1.5 text-sm"
                        value={spaceComplexity}
                        onChange={(e) => setSpaceComplexity(e.target.value)}
                      />
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase">
                      <input
                        type="checkbox"
                        checked={optimal}
                        onChange={(e) => setOptimal(e.target.checked)}
                        className="h-4 w-4 accent-[#FF6B6B]"
                      />
                      Matched optimal Big-O
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    <span className="flex items-center gap-1">
                      <FaPenToSquare className="text-neo-muted" /> Note
                    </span>
                    <textarea className="neo-input min-h-[64px] resize-y text-sm" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky submit */}
      <div className="border-t-4 border-black bg-neo-bg p-3">
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className="neo-btn w-full" onClick={submit}>
          <FaPaperPlane /> Submit report
          <span className="hidden text-[9px] font-bold opacity-50 md:inline">Ctrl+↵</span>
        </motion.button>
      </div>
    </>
  );

  if (mobile) {
    return (
      <>
        <motion.div
          className="fixed inset-0 z-40 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.aside
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          drag="y"
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info: PanInfo) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onClose();
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col border-t-4 border-black bg-neo-bg pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_0_0_#000]"
        >
          <div
            className="flex cursor-grab touch-none justify-center bg-white py-2"
            onPointerDown={(e) => drag.start(e)}
            aria-hidden
          >
            <span className="h-1.5 w-12 bg-black" />
          </div>
          {body}
        </motion.aside>
      </>
    );
  }

  return (
    <motion.aside
      initial={{ x: REPORT_W + 20 }}
      animate={{ x: 0 }}
      exit={{ x: REPORT_W + 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      style={{ width: REPORT_W }}
      className="absolute bottom-0 right-0 top-0 z-30 flex flex-col border-l-4 border-black bg-neo-bg shadow-[-8px_0_0_0_#000]"
    >
      {body}
    </motion.aside>
  );
}
