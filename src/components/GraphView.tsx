import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  FaBolt,
  FaCircleCheck,
  FaCheckDouble,
  FaXmark,
  FaArrowRight,
  FaStar,
  FaCircle,
  FaFire,
  FaLeaf,
  FaArrowUpRightFromSquare,
  FaRegClock,
  FaCode,
  FaLightbulb,
  FaRobot,
  FaPenToSquare,
  FaPaperPlane,
  FaShieldHalved,
  FaSkull,
  FaStopwatch,
  FaBan,
  FaKhanda,
  FaCrown,
  FaQuestion,
} from "react-icons/fa6";
import { type MapData, type MapNode } from "../map";
import { type Problem } from "../data/problems";
import { deriveNodeStatus, type NodeStatus } from "../state/nodeState";
import { touchedSlugs, type Attempt, type AttemptResult, type FailureMode } from "../state/attempts";
import { currentStreak } from "../state/analytics";
import { submitAttempt } from "../state/progress";
import { dueReviews, type ReviewItem } from "../state/reviews";
import { modifierOf, MODIFIER_META, type Modifier } from "../state/modifiers";
import { effectiveTimedLimit } from "../state/relics";
import { emitCoach } from "../state/coachBus";
import { mysteryPending, isMysteryNode } from "../state/events";
import { getInventory, type Inventory } from "../state/inventory";
import type { MapMeta } from "../state/library";
import { Celebration, type CelebrationData } from "./Celebration";
import { EventModal, ChestModal, BossIntro, Belt } from "./Loot";

const ROW_HEIGHT = 300;
const COL_WIDTH = 300;
const SQ_W = 168;
const SQ_H = 112;
const ACT_GAP = ROW_HEIGHT * 1.6; // visible break between acts in the layout

// Stable per-node pixel jitter (seeded by id) so nodes wobble off-grid like
// real StS maps instead of sitting in perfect columns. Deterministic, so it
// doesn't re-randomize on every render.
function jitter(id: string, range: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 2 * range;
}

function layout(map: MapData) {
  const rows = Math.max(...map.map((n) => n.row)) + 1;
  const maxCol = Math.max(...map.map((n) => n.col));
  const maxAct = Math.max(...map.map((n) => n.act));
  const width = maxCol * COL_WIDTH + SQ_W;
  const height = (rows - 1) * ROW_HEIGHT + SQ_H + maxAct * ACT_GAP;
  const pos = new Map<string, { x: number; y: number }>();
  map.forEach((n) => {
    const x = n.col * COL_WIDTH + SQ_W / 2 + jitter(n.id + "x", 14);
    const y = (rows - 1 - n.row) * ROW_HEIGHT + SQ_H / 2 + n.act * ACT_GAP + jitter(n.id + "y", 14);
    pos.set(n.id, { x, y });
  });
  return { pos, width, height };
}

interface SquareData extends Record<string, unknown> {
  available: boolean;
  visited: boolean;
  current: boolean;
  status: NodeStatus;
  title: string;
  elo: number;
  difficulty: string;
  topics: string;
  act: number;
  future: boolean;
  modifier: Modifier | null;
  rematchDue: boolean;
  mystery: boolean; // unopened "?" node: contents hidden
  boss: boolean; // act convergence node
}

const MODIFIER_ICON: Record<Modifier, ReactNode> = {
  elite: <FaSkull />,
  timed: <FaStopwatch />,
  purist: <FaBan />,
};

const MODIFIER_BG: Record<Modifier, string> = {
  elite: "bg-black text-white",
  timed: "bg-neo-blue text-black",
  purist: "bg-neo-pink text-white",
};

// Literal class strings so Tailwind's content scanner picks them up.
const STATUS_STYLE: Record<NodeStatus, string> = {
  unseen: "bg-white text-black",
  in_progress: "bg-neo-secondary text-black",
  solved: "bg-neo-ok text-black border-neo-ok",
  solved_with_help: "bg-neo-muted text-black border-neo-muted",
  failed: "bg-white text-neo-accent border-neo-accent",
  skipped: "bg-white text-black line-through decoration-2",
};

const DIFF_STYLE: Record<string, string> = {
  EASY: "bg-neo-ok text-black",
  MEDIUM: "bg-neo-orange text-black",
  HARD: "bg-neo-accent text-black",
};

const DIFF_RIBBON: Record<string, string> = {
  EASY: "bg-neo-ok",
  MEDIUM: "bg-neo-secondary",
  HARD: "bg-neo-accent",
};

const DIFF_ICON: Record<string, ReactNode> = {
  EASY: <FaLeaf />,
  MEDIUM: <FaFire />,
  HARD: <FaBolt />,
};

function StatusBadge({ status, current }: { status: NodeStatus; current: boolean }) {
  if (current) return <FaStar className="text-[13px] text-neo-secondary" />;
  switch (status) {
    case "solved":
      return <FaCircleCheck className="text-[13px] text-black" />;
    case "solved_with_help":
      return <FaCheckDouble className="text-[13px] text-black" />;
    case "failed":
      return <FaXmark className="text-[13px] text-black" />;
    case "skipped":
      return <FaArrowRight className="text-[13px] text-black" />;
    default:
      return <FaCircle className="text-[13px] text-black/40" />;
  }
}

function SquareNode({ data }: NodeProps) {
  const d = data as SquareData;
  const statusCls = STATUS_STYLE[d.status];
  const diffCls = DIFF_STYLE[d.difficulty] ?? "bg-white text-black";
  const diffIcon = DIFF_ICON[d.difficulty] ?? <FaCircle />;
  const diffRibbon = DIFF_RIBBON[d.difficulty] ?? "bg-neo-blue";

  // Unopened mystery node: face-down card, contents hidden.
  if (d.mystery) {
    return (
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08, y: -5, rotate: 2 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 20 }}
        className={`group relative flex flex-col items-center justify-center gap-1 overflow-visible border-4 border-black bg-black p-2 shadow-neo-sm ${
          d.available ? "cursor-pointer" : "cursor-default opacity-80"
        }`}
        style={{ width: SQ_W, height: SQ_H }}
      >
        {d.available && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -inset-2 z-0 border-4 border-neo-pink"
            animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <Handle id="top-0" type="source" position={Position.Top} isConnectable={false} style={{ left: "16.6%", opacity: 0, pointerEvents: "none" }} />
        <Handle id="top-1" type="source" position={Position.Top} isConnectable={false} style={{ left: "50%", opacity: 0, pointerEvents: "none" }} />
        <Handle id="top-2" type="source" position={Position.Top} isConnectable={false} style={{ left: "83.3%", opacity: 0, pointerEvents: "none" }} />
        <Handle id="bottom-0" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "16.6%", opacity: 0, pointerEvents: "none" }} />
        <Handle id="bottom-1" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "50%", opacity: 0, pointerEvents: "none" }} />
        <Handle id="bottom-2" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "83.3%", opacity: 0, pointerEvents: "none" }} />
        <motion.span
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="text-4xl text-neo-secondary"
        >
          <FaQuestion />
        </motion.span>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Mystery</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.08, y: -5, rotate: d.current ? -2 : 1.5 }}
      whileTap={{ scale: 0.92, rotate: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      className={`group relative flex flex-col justify-between overflow-visible border-4 border-black p-2 shadow-neo-sm ${
        d.future ? "opacity-60" : statusCls
      } ${d.current ? "!bg-neo-accent !text-black !shadow-neo z-10" : ""} ${
        d.future ? "cursor-not-allowed" : d.available ? "cursor-pointer" : "cursor-default"
      }`}
      style={{ width: SQ_W, height: SQ_H }}
    >
      {d.available && !d.current && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-2 z-0 border-4 border-neo-accent"
          animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Handle id="top-0" type="source" position={Position.Top} isConnectable={false} style={{ left: "16.6%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="top-1" type="source" position={Position.Top} isConnectable={false} style={{ left: "50%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="top-2" type="source" position={Position.Top} isConnectable={false} style={{ left: "83.3%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom-0" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "16.6%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom-1" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "50%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom-2" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "83.3%", opacity: 0, pointerEvents: "none" }} />

      <div className="absolute left-1 top-1 grid h-6 w-6 place-items-center border-2 border-black bg-white transition-transform duration-150 group-hover:scale-110">
        <StatusBadge status={d.status} current={d.current} />
      </div>

      <div className="absolute -right-2 -top-3 z-20 flex -rotate-3 items-stretch border-2 border-black bg-black shadow-neo-sm transition-all duration-150 group-hover:rotate-0 group-hover:scale-110">
        <span className={`grid place-items-center px-1 ${diffRibbon}`}>
          <FaBolt className="text-[9px] text-black" />
        </span>
        <span className="px-1.5 py-0.5 text-[11px] font-black tabular-nums leading-none text-white">
          {d.elo}
        </span>
      </div>

      <div className={`absolute inset-x-0 top-0 z-0 h-2 ${diffRibbon}`} />

      <div className="mt-5 pr-8 text-[12px] font-black uppercase leading-tight line-clamp-2">
        {d.title}
      </div>

      <div className="truncate text-[9px] font-bold uppercase opacity-80" title={d.topics}>
        {d.topics}
      </div>

      <div className="flex items-center justify-between gap-1">
        <span className={`flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-[9px] font-black uppercase ${diffCls}`}>
          {diffIcon} {d.difficulty}
        </span>
        {d.modifier && (
          <span
            title={MODIFIER_META[d.modifier].desc}
            className={`flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-[9px] font-black uppercase transition-transform duration-150 group-hover:-rotate-3 group-hover:scale-110 ${MODIFIER_BG[d.modifier]}`}
          >
            {MODIFIER_ICON[d.modifier]} {MODIFIER_META[d.modifier].label}
          </span>
        )}
      </div>

      {d.rematchDue && (
        <motion.div
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          title="Rematch due — beat it this time"
          className="absolute -bottom-3 -left-2 z-20 grid h-7 w-7 place-items-center border-4 border-black bg-neo-accent text-[12px] text-white shadow-neo-sm"
        >
          <FaKhanda />
        </motion.div>
      )}

      {d.boss && (
        <motion.div
          animate={{ y: [-2, 2, -2] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          title="Boss node — clear it to breach the next act (guaranteed relic chest)"
          className="absolute -top-5 left-1/2 z-20 grid h-8 w-8 -translate-x-1/2 place-items-center border-4 border-black bg-black text-[14px] text-neo-secondary shadow-neo-sm"
        >
          <FaCrown />
        </motion.div>
      )}
    </motion.div>
  );
}

const nodeTypes = { square: SquareNode };

function Legend() {
  const items: { label: string; cls: string; icon: ReactNode }[] = [
    { label: "Available", cls: "bg-neo-secondary", icon: <FaArrowRight className="text-[10px]" /> },
    { label: "You are here", cls: "bg-neo-accent", icon: <FaStar className="text-[10px] text-neo-secondary" /> },
    { label: "Solved", cls: "bg-neo-ok", icon: <FaCircleCheck className="text-[10px]" /> },
    { label: "Solved w/ help", cls: "bg-neo-muted", icon: <FaCheckDouble className="text-[10px]" /> },
    { label: "Failed", cls: "bg-white border-neo-accent", icon: <FaXmark className="text-[10px]" /> },
    { label: "Elite ×1.5", cls: "bg-black", icon: <FaSkull className="text-[10px] text-white" /> },
    { label: "Timed bonus", cls: "bg-neo-blue", icon: <FaStopwatch className="text-[10px]" /> },
    { label: "Purist bonus", cls: "bg-neo-pink", icon: <FaBan className="text-[10px] text-white" /> },
    { label: "Rematch due", cls: "bg-neo-accent", icon: <FaKhanda className="text-[10px] text-white" /> },
  ];
  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="pointer-events-none absolute bottom-16 left-4 z-20 hidden rotate-[-1deg] border-4 border-black bg-white p-3 shadow-neo md:block"
    >
      <div className="mb-2 flex items-center gap-1 text-xs font-black uppercase tracking-widest">
        <FaFire className="text-neo-accent" /> Legend
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-[11px] font-bold uppercase">
            <span className={`inline-grid h-4 w-4 place-items-center border-2 border-black ${it.cls}`}>{it.icon}</span>
            {it.label}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function ReportPanel({
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
  const modifier = modifierOf(problem.slug);
  const [secondChance, setSecondChance] = useState(false);
  const [result, setResult] = useState<AttemptResult>("solved");
  const [readTime, setReadTime] = useState(0);
  const [writeTime, setWriteTime] = useState(() =>
    Math.max(0, Math.round((Date.now() - startTime) / 1000))
  );
  const [debugTime, setDebugTime] = useState(0);
  const [hints, setHints] = useState(false);
  const [ai, setAi] = useState(false);
  const [verified, setVerified] = useState(false);
  const [failureMode, setFailureMode] = useState<FailureMode | "">("");
  const [timeComplexity, setTimeComplexity] = useState("");
  const [spaceComplexity, setSpaceComplexity] = useState("");
  const [optimal, setOptimal] = useState(false);
  const [note, setNote] = useState("");

  const total = readTime + writeTime + debugTime;
  const isFailure = result !== "solved" && result !== "solved_with_help";

  return (
    <motion.aside
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="absolute right-0 top-0 z-30 flex h-full w-full max-w-[360px] flex-col gap-4 overflow-y-auto border-l-4 border-black bg-neo-bg p-4 shadow-[-8px_0_0_0_#000] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-black uppercase leading-none tracking-tight">
            {blind ? (
              <>
                <FaQuestion className="text-neo-pink" /> ??? Mystery Problem
              </>
            ) : (
              <>
                <FaBolt className="text-neo-accent" /> {problem.title}
              </>
            )}
          </div>
          {!blind && (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`neo-tag ${DIFF_STYLE[problem.difficulty] ?? "bg-neo-secondary text-black"}`}>
                  {problem.difficulty}
                </span>
                <span className="inline-flex items-stretch border-4 border-black bg-black shadow-neo-sm">
                  <span className="grid place-items-center bg-neo-secondary px-1.5">
                    <FaBolt className="text-[10px] text-black" />
                  </span>
                  <span className="px-2 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    Elo {problem.elo}
                  </span>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-black/70">
                <FaFire /> {problem.topics.join(", ")}
              </div>
            </>
          )}
          {blind && (
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-black/70">
              Title, elo and topics stay hidden. The link works — solve blind for the bounty.
            </p>
          )}
        </div>
        <motion.button
          onClick={onClose}
          aria-label="Close report panel"
          whileTap={{ scale: 0.85 }}
          className="grid h-10 w-10 shrink-0 place-items-center border-4 border-black bg-white text-xl font-black shadow-neo-sm transition-all duration-100 hover:bg-neo-accent"
        >
          <FaXmark />
        </motion.button>
      </div>

      <motion.a
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="neo-btn neo-btn-yellow w-full"
        href={problem.link}
        target="_blank"
        rel="noreferrer"
      >
        <FaArrowUpRightFromSquare /> Open problem
      </motion.a>

      {modifier && (
        <div className={`flex items-center gap-2 border-4 border-black p-2 text-[11px] font-black uppercase shadow-neo-sm ${MODIFIER_BG[modifier]}`}>
          {MODIFIER_ICON[modifier]}
          <span>
            {MODIFIER_META[modifier].label} node — {MODIFIER_META[modifier].desc}
            {modifier === "timed" && ` Limit: ${Math.round(effectiveTimedLimit(problem.slug, problem.difficulty) / 60)} min.`}
          </span>
        </div>
      )}

      {canSecondChance && (
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSecondChance((s) => !s)}
          aria-pressed={secondChance}
          className={`flex items-center gap-2 border-4 border-black p-2 text-[11px] font-black uppercase shadow-neo-sm transition-colors ${
            secondChance ? "bg-neo-blue text-white" : "bg-white text-black/60 hover:text-black"
          }`}
        >
          <FaShieldHalved />
          {secondChance
            ? "Second Chance ARMED — a fail costs nothing"
            : "Arm Second Chance potion (fail = no rating loss)"}
        </motion.button>
      )}

      <div className="flex flex-col gap-1.5 text-sm font-bold uppercase tracking-wide">
        <span className="flex items-center gap-1">
          <FaCircleCheck className="text-neo-ok" /> Result
        </span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Result">
          {(
            [
              { val: "solved", label: "Solved", cls: "bg-neo-ok", icon: <FaCircleCheck key="i" /> },
              { val: "solved_with_help", label: "With help", cls: "bg-neo-muted", icon: <FaCheckDouble key="i" /> },
              { val: "gave_up", label: "Gave up", cls: "bg-neo-accent", icon: <FaXmark key="i" /> },
              { val: "abandoned", label: "Abandoned", cls: "bg-neo-secondary", icon: <FaArrowRight key="i" /> },
            ] as { val: AttemptResult; label: string; cls: string; icon: ReactNode }[]
          ).map((o) => (
            <motion.button
              key={o.val}
              type="button"
              role="radio"
              aria-checked={result === o.val}
              whileHover={{ y: -3, rotate: -1 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => setResult(o.val)}
              className={`flex items-center justify-center gap-1.5 border-4 border-black px-2 py-2.5 text-xs font-black uppercase transition-all duration-100 ${
                result === o.val
                  ? `${o.cls} shadow-neo-sm`
                  : "bg-white text-black/60 hover:text-black hover:bg-neo-bg"
              }`}
            >
              {o.icon} {o.label}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isFailure && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-1.5 overflow-hidden text-sm font-bold uppercase tracking-wide"
          >
            <span className="flex items-center gap-1">
              <FaXmark className="text-neo-accent" /> Failure mode
            </span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { val: "wrong-answer", label: "Wrong answer" },
                  { val: "tle", label: "TLE" },
                  { val: "runtime-error", label: "Runtime err" },
                  { val: "compile-error", label: "Compile err" },
                ] as { val: FailureMode; label: string }[]
              ).map((o) => (
                <motion.button
                  key={o.val}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setFailureMode(failureMode === o.val ? "" : o.val)}
                  aria-pressed={failureMode === o.val}
                  className={`border-4 border-black px-2.5 py-1.5 text-[11px] font-black uppercase transition-all duration-100 ${
                    failureMode === o.val
                      ? "bg-neo-accent shadow-neo-sm"
                      : "bg-white text-black/60 hover:text-black hover:bg-neo-bg"
                  }`}
                >
                  {o.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <fieldset className="flex flex-col gap-2 border-4 border-black bg-white p-3 shadow-neo-sm">
        <legend className="flex items-center gap-1 px-2 text-xs font-black uppercase tracking-widest">
          <FaRegClock className="text-neo-blue" /> Time (s) by phase
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase">
            Read
            <input
              type="number"
              min={0}
              className="neo-input !py-2 text-center"
              value={readTime}
              onChange={(e) => setReadTime(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase">
            Write
            <input
              type="number"
              min={0}
              className="neo-input !py-2 text-center"
              value={writeTime}
              onChange={(e) => setWriteTime(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase">
            Debug
            <input
              type="number"
              min={0}
              className="neo-input !py-2 text-center"
              value={debugTime}
              onChange={(e) => setDebugTime(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="text-right text-xs font-black uppercase tracking-wide">Total: {total}s</div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border-4 border-black bg-white p-3 shadow-neo-sm">
        <legend className="flex items-center gap-1 px-2 text-xs font-black uppercase tracking-widest">
          <FaCode className="text-neo-muted" /> Complexity
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase">
            Time
            <input
              type="text"
              placeholder="O(n)"
              className="neo-input !py-2"
              value={timeComplexity}
              onChange={(e) => setTimeComplexity(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase">
            Space
            <input
              type="text"
              placeholder="O(1)"
              className="neo-input !py-2"
              value={spaceComplexity}
              onChange={(e) => setSpaceComplexity(e.target.value)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold uppercase">
          <input
            type="checkbox"
            checked={optimal}
            onChange={(e) => setOptimal(e.target.checked)}
            className="h-5 w-5 accent-[#FF6B6B]"
          />
          Matched optimal Big-O
        </label>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { label: "Hints", val: hints, setter: setHints, icon: <FaLightbulb key="h" /> },
            { label: "AI", val: ai, setter: setAi, icon: <FaRobot key="a" /> },
            { label: "Verified", val: verified, setter: setVerified, icon: <FaShieldHalved key="v" /> },
          ] as { label: string; val: boolean; setter: (b: boolean) => void; icon: ReactNode }[]
        ).map(({ label, val, setter, icon }) => (
          <motion.button
            key={label}
            type="button"
            whileHover={{ y: -3, rotate: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setter(!val)}
            aria-pressed={val}
            className={`flex flex-col items-center gap-1 border-4 border-black px-2 py-2.5 text-[11px] font-black uppercase transition-all duration-100 ${
              val ? "bg-neo-secondary shadow-neo-sm" : "bg-white text-black/60 hover:text-black hover:bg-neo-bg"
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </motion.button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold uppercase tracking-wide">
        <span className="flex items-center gap-1">
          <FaPenToSquare className="text-neo-muted" /> Note
        </span>
        <textarea
          className="neo-input min-h-[80px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </label>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        className="neo-btn mt-auto w-full"
        onClick={() =>
          onSubmit(
            {
              result,
              time: total,
              hints,
              ai,
              verified,
              note,
              at: Date.now(),
              readTime,
              writeTime,
              debugTime,
              failureMode: isFailure ? (failureMode || null) : null,
              timeComplexity,
              spaceComplexity,
              optimal,
            },
            { secondChance }
          )
        }
      >
        <FaPaperPlane /> Submit report
      </motion.button>
    </motion.aside>
  );
}

export function GraphView({
  map,
  viewAct,
  onAttempt,
}: {
  map: MapMeta;
  viewAct: number;
  onAttempt?: () => void;
}) {
  const data: MapData = map.nodes;
  const bySlug = map.problems;

  // Resume from the deepest attempted node so a refresh doesn't send you back
  // to the start — the attempt log (persisted) is the source of truth.
  const [visited, setVisited] = useState<Set<string>>(() => {
    const touched = touchedSlugs();
    return new Set(data.filter((n) => touched.has(n.slug)).map((n) => n.id));
  });
  const [current, setCurrent] = useState<string | null>(() => {
    const touched = touchedSlugs();
    let best: string | null = null;
    let bestRow = -1;
    for (const n of data) {
      if (touched.has(n.slug) && n.row > bestRow) {
        bestRow = n.row;
        best = n.id;
      }
    }
    return best;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  // Roguelike state: inventory mirror, mystery event flow, boss intro, shake.
  const [inv, setInv] = useState<Inventory>(() => getInventory());
  const [eventNode, setEventNode] = useState<string | null>(null);
  const [blindAttempt, setBlindAttempt] = useState(false);
  const [bossIntroFor, setBossIntroFor] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  // Rematch (spaced-repetition) state.
  const [attemptsRev, setAttemptsRev] = useState(0);
  const [rematchSlug, setRematchSlug] = useState<string | null>(null);
  const [showRematches, setShowRematches] = useState(false);
  const mapSlugs = useMemo(() => new Set(data.map((n) => n.slug)), [data]);
  const due: ReviewItem[] = useMemo(() => {
    void attemptsRev;
    return dueReviews(mapSlugs);
  }, [mapSlugs, attemptsRev]);
  const dueSet = useMemo(() => new Set(due.map((r) => r.slug)), [due]);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { pos, width, height } = useMemo(() => layout(data), [data]);

  // Per-act metadata: row span + start/end node ids for the current band.
  const actInfo = useMemo(() => {
    const total = Math.max(...data.map((n) => n.act)) + 1;
    const info: { startRow: number; endRow: number; startId: string; endId: string }[] = [];
    for (let a = 0; a < total; a++) {
      const inAct = data.filter((n) => n.act === a);
      const startRow = Math.min(...inAct.map((n) => n.row));
      const endRow = Math.max(...inAct.map((n) => n.row));
      info.push({
        startRow,
        endRow,
        startId: inAct.find((n) => n.row === startRow)!.id,
        endId: inAct.find((n) => n.row === endRow)!.id,
      });
    }
    return info;
  }, [data]);

  // The act the player is in. Completing an act's convergence node (the gate,
  // which bridges into the next act) advances the act so the next act unlocks.
  // Highest graph y (top edge) the player is allowed to see — the top of the
  // viewed act (its convergence node, gap-aware). Only one act is shown at a
  // time, so the viewport is locked to that act.
  const lockTopY = useMemo(() => {
    const sp = pos.get(actInfo[viewAct].endId);
    return sp ? sp.y - SQ_H / 2 : 0;
  }, [actInfo, viewAct, data, pos]);

  const clampViewport = (vp: { x: number; y: number; zoom: number }) => {
    const vw = wrapRef.current?.clientWidth ?? 0;
    const vh = wrapRef.current?.clientHeight ?? 0;
    // Vertical: keep the visible top at/below the current act's top so future
    // acts stay hidden; allow scrolling down to reveal previous (completed) acts.
    const yMax = -lockTopY;
    const yMin = vh - height;
    const y = Math.min(yMax, Math.max(yMin, vp.y));
    // Horizontal: if the graph fits the viewport, lock it centered (no drift /
    // no snap). If it's wider, clamp to its edges so you can scroll but not
    // past them.
    const x = width <= vw ? (vw - width) / 2 : Math.min(0, Math.max(vw - width, vp.x));
    return { x, y, zoom: 1 };
  };

  const goToStart = () => {
    const vw = wrapRef.current?.clientWidth ?? 0;
    const vh = wrapRef.current?.clientHeight ?? 0;
    const sp = pos.get(actInfo[viewAct].startId);
    if (!sp) return;
    const c = clampViewport({ x: vw / 2 - sp.x, y: vh / 2 - sp.y, zoom: 1 });
    rfRef.current?.setViewport(c, { duration: 0 });
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const vp = rfRef.current?.getViewport();
      if (vp) rfRef.current?.setViewport(clampViewport(vp), { duration: 0 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    goToStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, viewAct]);

  const inEdges = useMemo(() => {
    const m = new Map<string, string[]>();
    data.forEach((n) =>
      n.edges_out.forEach((t) => {
        if (!m.has(t)) m.set(t, []);
        m.get(t)!.push(n.id);
      })
    );
    return m;
  }, [data]);

  const portOf = (from: string, to: string) => {
    const a = pos.get(from)!;
    const b = pos.get(to)!;
    const fn = data.find((n) => n.id === from)!;
    const sources = inEdges.get(to) ?? [];
    const dir = (dx: number) => (dx < 0 ? 0 : dx > 0 ? 2 : 1);
    const fromIdx = fn.edges_out.length === 1 ? 1 : dir(b.x - a.x);
    const toIdx = sources.length === 1 ? 1 : dir(a.x - b.x);
    return { fromIdx, toIdx };
  };

  // A node is attemptable when order isn't broken: entry-row nodes are always
  // open, and any untouched node unlocks once ANY of its parents has been
  // attempted. This opens sibling paths for extra practice instead of locking
  // you to a single walk like real StS.
  const available = useMemo(
    () =>
      data
        .filter((n) => {
          if (visited.has(n.id)) return false;
          if (n.row === 0) return true;
          const parents = inEdges.get(n.id) ?? [];
          return parents.some((p) => visited.has(p));
        })
        .map((n) => n.id),
    [data, visited, inEdges]
  );

  const statusOf = (n: MapNode): NodeStatus => {
    const st = deriveNodeStatus(n.slug);
    if (st === "unseen" && available.includes(n.id)) return "in_progress";
    return st;
  };

  const rfNodes: Node[] = useMemo(
    () =>
      data
        .filter((n) => n.act === viewAct)
        .map((n) => {
          const p = pos.get(n.id)!;
          return {
            id: n.id,
            type: "square",
            position: { x: p.x - SQ_W / 2, y: p.y - SQ_H / 2 },
            data: {
              available: available.includes(n.id),
              visited: visited.has(n.id),
              current: current === n.id,
              status: statusOf(n),
              title: bySlug[n.slug]?.title ?? n.slug,
              elo: bySlug[n.slug]?.elo ?? 0,
              difficulty: bySlug[n.slug]?.difficulty ?? "",
              topics: (bySlug[n.slug]?.topics ?? []).join(" · "),
              act: n.act,
              future: false,
              modifier: modifierOf(n.slug),
              rematchDue: dueSet.has(n.slug),
              mystery: isMysteryNode(n.slug) && !inv.eventsSeen.includes(n.slug) && !visited.has(n.id),
              boss: n.row === actInfo[n.act].endRow,
            } as SquareData,
          };
        }),
    [data, pos, available, visited, current, viewAct, dueSet, inv, actInfo]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      data
        .filter((n) => n.act === viewAct)
        .flatMap((n) =>
          n.edges_out
            .filter((tid) => (data.find((t) => t.id === tid)?.act ?? 0) === viewAct)
            .map((tid) => {
              const { fromIdx, toIdx } = portOf(n.id, tid);
              const active = visited.has(n.id) && (visited.has(tid) || current === tid);
              return {
                id: `${n.id}-${tid}`,
                source: n.id,
                target: tid,
                sourceHandle: `top-${fromIdx}`,
                targetHandle: `bottom-${toIdx}`,
                type: "default",
                className: active ? "edge active" : "edge",
              } as Edge;
            })
        ),
    [data, pos, visited, current, viewAct]
  );

  const isBossId = (id: string): boolean => {
    const n = data.find((x) => x.id === id);
    return Boolean(n && n.row === actInfo[n.act].endRow);
  };

  function openPanel(id: string, blind = false) {
    setBlindAttempt(blind);
    setSelected(id);
    setStartTime(Date.now());
    const slug = data.find((n) => n.id === id)?.slug;
    emitCoach({
      type: "opened",
      title: blind ? "a mystery" : (slug && bySlug[slug]?.title) || "this one",
    });
  }

  function open(id: string) {
    if (!available.includes(id)) return;
    const slug = data.find((n) => n.id === id)!.slug;
    if (mysteryPending(slug)) {
      setEventNode(id);
    } else if (isBossId(id)) {
      setBossIntroFor(id);
      emitCoach({ type: "interview-start" });
    } else {
      openPanel(id);
    }
  }

  function submitReport(a: Attempt, opts: { secondChance: boolean }) {
    const slug = rematchSlug ?? (selected ? data.find((n) => n.id === selected)!.slug : null);
    if (!slug) return;
    const boss = Boolean(selected && !rematchSlug && isBossId(selected));
    const outcome = submitAttempt(
      slug,
      { ...a, at: Date.now() },
      { secondChance: opts.secondChance, isBossNode: boss }
    );
    if (selected && !rematchSlug) {
      setVisited((prev) => new Set(prev).add(selected));
      setCurrent(selected);
    }
    setSelected(null);
    setRematchSlug(null);
    setBlindAttempt(false);
    setAttemptsRev((r) => r + 1);
    setInv(getInventory());
    if (outcome.crit || (boss && outcome.ratingDelta > 0)) {
      setShake((s) => s + 1);
    }
    const p = bySlug[slug];
    setCelebration({
      kind: a.result === "solved" ? "solved" : a.result === "solved_with_help" ? "assisted" : "logged",
      title: p?.title ?? slug,
      elo: p?.elo ?? 0,
      streak: currentStreak(),
      seq: Date.now(),
      ratingDelta: outcome.ratingDelta,
      ratingAfter: outcome.ratingAfter,
      achievements: outcome.newAchievements.map((x) => x.name),
      questCompleted: outcome.questJustCompleted,
      crit: outcome.crit,
      effectNotes: outcome.effectNotes,
      curseGained: outcome.curseGained,
      curseCleansed: outcome.curseCleansed,
      combo: outcome.comboToday,
    });
    if (outcome.newAchievements.length > 0) {
      emitCoach({ type: "achievement", name: outcome.newAchievements[0].name });
    } else if (a.result === "solved") {
      emitCoach({ type: "solved", clean: !a.hints && !a.ai });
    } else if (a.result === "solved_with_help") {
      emitCoach({ type: "assisted" });
    } else {
      emitCoach({ type: "failed" });
    }
    onAttempt?.();
  }

  const selectedNode = selected ? data.find((n) => n.id === selected) : null;
  const selectedProblem = rematchSlug
    ? (bySlug[rematchSlug] ?? null)
    : selectedNode
      ? bySlug[selectedNode.slug]
      : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col p-2 md:p-5">
      <motion.div
        key={`shake-${shake}`}
        animate={shake > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0], y: [0, 5, -5, 4, -4, 2, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="relative min-h-0 flex-1 overflow-hidden border-4 border-black bg-neo-bg shadow-neo"
        ref={wrapRef}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => open(node.id)}
          onInit={(inst) => {
            rfRef.current = inst;
            goToStart();
          }}
          onViewportChange={(vp) => {
            const c = clampViewport(vp);
            if (c.x !== vp.x || c.y !== vp.y || c.zoom !== vp.zoom) {
              rfRef.current?.setViewport(c, { duration: 0 });
            }
          }}
          minZoom={1}
          maxZoom={1}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnScroll
          panOnDrag
          nodesDraggable={false}
          nodesConnectable={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} gap={40} color="rgba(0,0,0,0.10)" />
        </ReactFlow>

        <Legend />

        {/* Rematch queue badge + drawer */}
        {due.length > 0 && (
          <motion.button
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowRematches((s) => !s)}
            className="absolute right-4 top-4 z-20 flex rotate-1 items-center gap-2 border-4 border-black bg-neo-accent px-3 py-2 text-sm font-black uppercase text-white shadow-neo"
          >
            <motion.span animate={{ rotate: [-10, 10, -10] }} transition={{ duration: 1.2, repeat: Infinity }}>
              <FaKhanda />
            </motion.span>
            {due.length} rematch{due.length > 1 ? "es" : ""} due
          </motion.button>
        )}
        <AnimatePresence>
          {showRematches && due.length > 0 && (
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="absolute right-4 top-16 z-20 flex max-h-[60%] w-72 flex-col overflow-hidden border-4 border-black bg-white shadow-neo"
            >
              <div className="border-b-4 border-black bg-neo-secondary px-3 py-2 text-xs font-black uppercase">
                Beat them this time
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {due.map((r) => {
                  const p = bySlug[r.slug];
                  return (
                    <motion.button
                      key={r.slug}
                      whileHover={{ x: 5 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setRematchSlug(r.slug);
                        setSelected(null);
                        setStartTime(Date.now());
                        setShowRematches(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 border-b-2 border-black px-3 py-2 text-left transition-colors hover:bg-neo-bg"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black uppercase">{p?.title ?? r.slug}</div>
                        <div className="text-[10px] font-bold uppercase text-black/60">
                          {p?.elo ?? "?"} elo · last: {r.lastResult.replace(/_/g, " ")}
                          {r.overdueDays > 0 ? ` · ${r.overdueDays}d overdue` : " · due today"}
                        </div>
                      </div>
                      <FaKhanda className="shrink-0 text-neo-accent" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Belt
          inv={inv}
          onChanged={() => {
            setInv(getInventory());
            onAttempt?.();
          }}
        />

        <AnimatePresence>
          {eventNode && (
            <EventModal
              slug={data.find((n) => n.id === eventNode)!.slug}
              onProceed={(blind) => {
                const id = eventNode;
                setEventNode(null);
                setInv(getInventory());
                if (id) openPanel(id, blind);
              }}
              onClose={() => setEventNode(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {bossIntroFor && (
            <BossIntro
              title={bySlug[data.find((n) => n.id === bossIntroFor)!.slug]?.title ?? "The Gatekeeper"}
              onDone={() => {
                const id = bossIntroFor;
                setBossIntroFor(null);
                if (id) openPanel(id);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {inv.pendingChest && !celebration && (
            <ChestModal
              onDone={(relic) => {
                setInv(getInventory());
                if (relic) emitCoach({ type: "achievement", name: relic.name });
                onAttempt?.();
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {celebration && (
            <Celebration data={celebration} onDone={() => setCelebration(null)} />
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selectedProblem && (
          <ReportPanel
            problem={selectedProblem}
            startTime={startTime}
            blind={blindAttempt}
            canSecondChance={inv.potions.includes("second-chance")}
            onClose={() => {
              setSelected(null);
              setRematchSlug(null);
              setBlindAttempt(false);
            }}
            onSubmit={submitReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
