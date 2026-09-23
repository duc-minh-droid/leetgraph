import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
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
  FaSkull,
  FaStopwatch,
  FaBan,
  FaKhanda,
  FaCrown,
  FaQuestion,
  FaLock,
} from "react-icons/fa6";
import type { NodeStatus } from "../../state/nodeState";
import { MODIFIER_META, type Modifier } from "../../state/modifiers";
import { AURA_META, type Aura } from "../../state/auras";
import { SQ_W, SQ_H } from "./layout";

export interface SquareData extends Record<string, unknown> {
  available: boolean;
  visited: boolean;
  current: boolean;
  status: NodeStatus;
  title: string;
  elo: number;
  difficulty: string;
  topics: string;
  act: number;
  locked: boolean; // not yet reachable
  modifier: Modifier | null;
  rematchDue: boolean;
  mystery: boolean; // unopened "?" node: contents hidden
  boss: boolean; // act convergence node
  aura: Aura | null; // today's RNG aura on this node
  fresh: number; // >0 = just unlocked (stagger index + 1)
  stamp: number; // bumps when this node was just attempted (impact anim)
}

export const MODIFIER_ICON: Record<Modifier, ReactNode> = {
  elite: <FaSkull />,
  timed: <FaStopwatch />,
  purist: <FaBan />,
};

export const MODIFIER_BG: Record<Modifier, string> = {
  elite: "bg-black text-white",
  timed: "bg-neo-blue text-black",
  purist: "bg-neo-pink text-white",
};

// Literal class strings so Tailwind's content scanner picks them up.
const STATUS_STYLE: Record<NodeStatus, string> = {
  unseen: "bg-white text-black",
  in_progress: "bg-neo-secondary text-black",
  solved: "bg-neo-ok text-black",
  solved_with_help: "bg-neo-muted text-black",
  failed: "bg-white text-neo-accent",
  skipped: "bg-white text-black line-through decoration-2",
};

export const STATUS_HEX: Record<NodeStatus, string> = {
  unseen: "#ffffff",
  in_progress: "#FFD93D",
  solved: "#4ADE80",
  solved_with_help: "#C4B5FD",
  failed: "#FF6B6B",
  skipped: "#e5e5e5",
};

export const DIFF_HEX: Record<string, string> = {
  EASY: "#4ADE80",
  MEDIUM: "#FF9F45",
  HARD: "#FF6B6B",
};

const DIFF_ICON: Record<string, ReactNode> = {
  EASY: <FaLeaf />,
  MEDIUM: <FaFire />,
  HARD: <FaBolt />,
};

function StatusIcon({ status, current, className = "" }: { status: NodeStatus; current: boolean; className?: string }) {
  if (current) return <FaStar className={className} />;
  switch (status) {
    case "solved":
      return <FaCircleCheck className={className} />;
    case "solved_with_help":
      return <FaCheckDouble className={className} />;
    case "failed":
      return <FaXmark className={className} />;
    case "skipped":
      return <FaArrowRight className={className} />;
    case "in_progress":
      return <FaArrowRight className={className} />;
    default:
      return <FaCircle className={`opacity-30 ${className}`} />;
  }
}

const HANDLE_STYLE = { opacity: 0, pointerEvents: "none" as const };
function Handles() {
  return (
    <>
      <Handle id="top-0" type="source" position={Position.Top} isConnectable={false} style={{ ...HANDLE_STYLE, left: "16.6%" }} />
      <Handle id="top-1" type="source" position={Position.Top} isConnectable={false} style={{ ...HANDLE_STYLE, left: "50%" }} />
      <Handle id="top-2" type="source" position={Position.Top} isConnectable={false} style={{ ...HANDLE_STYLE, left: "83.3%" }} />
      <Handle id="bottom-0" type="target" position={Position.Bottom} isConnectable={false} style={{ ...HANDLE_STYLE, left: "16.6%" }} />
      <Handle id="bottom-1" type="target" position={Position.Bottom} isConnectable={false} style={{ ...HANDLE_STYLE, left: "50%" }} />
      <Handle id="bottom-2" type="target" position={Position.Bottom} isConnectable={false} style={{ ...HANDLE_STYLE, left: "83.3%" }} />
    </>
  );
}

// Level of detail: below this zoom, cards collapse into big readable tokens.
const LOD_ZOOM = 0.58;
const zoomSel = (s: { transform: [number, number, number] }) => s.transform[2] < LOD_ZOOM;

function SquareNodeImpl({ data }: NodeProps) {
  const d = data as SquareData;
  const far = useStore(zoomSel);
  const diffHex = DIFF_HEX[d.difficulty] ?? "#4D96FF";
  const interactive = d.available && !d.locked;

  // Just-unlocked pop + just-attempted stamp, driven by data changes.
  const animate = d.fresh
    ? { scale: [0.4, 1.22, 1], opacity: [0, 1, 1], transition: { duration: 0.55, delay: 0.25 + d.fresh * 0.12 } }
    : d.stamp
      ? { scale: [1, 0.82, 1.14, 1], rotate: [0, -4, 3, 0], transition: { duration: 0.5 } }
      : { scale: 1, opacity: 1 };

  const base = `group relative border-4 border-black ${
    interactive ? "cursor-pointer" : "cursor-default"
  } ${d.locked ? "grayscale-[0.7] opacity-55" : ""}`;

  // ---- shared glow / markers ----
  const glow = interactive && !d.current && (
    <span aria-hidden className="node-glow pointer-events-none absolute -inset-[9px] z-0 border-4 border-neo-accent" />
  );
  const currentRing = d.current && (
    <span aria-hidden className="node-ants pointer-events-none absolute -inset-[10px] z-0" />
  );

  // ---- mystery ----
  if (d.mystery) {
    return (
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={animate}
        whileHover={interactive ? { scale: 1.06, y: -4, rotate: 2 } : {}}
        whileTap={interactive ? { scale: 0.93 } : {}}
        transition={{ type: "spring", stiffness: 420, damping: 20 }}
        className={`${base} flex flex-col items-center justify-center gap-1 bg-black shadow-neo-sm`}
        style={{ width: SQ_W, height: SQ_H }}
      >
        {glow}
        <Handles />
        <FaQuestion className={`text-neo-secondary ${far ? "text-6xl" : "text-4xl"} ${interactive ? "node-bob" : ""}`} />
        {!far && <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Mystery</span>}
      </motion.div>
    );
  }

  // ---- far zoom: token ----
  if (far) {
    return (
      <motion.div
        initial={false}
        animate={animate}
        className={`${base} flex items-center justify-center gap-3 shadow-neo-sm ${
          d.current ? "!bg-neo-accent" : STATUS_STYLE[d.status]
        }`}
        style={{ width: SQ_W, height: SQ_H }}
      >
        {glow}
        {currentRing}
        <Handles />
        <span className="absolute inset-y-0 left-0 w-4 border-r-4 border-black" style={{ background: diffHex }} />
        <span className="ml-3 text-5xl">
          {d.locked ? <FaLock className="opacity-60" /> : <StatusIcon status={d.status} current={d.current} />}
        </span>
        <span className="text-4xl font-black tabular-nums">{d.elo}</span>
        {d.boss && (
          <span className="absolute -top-9 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center border-4 border-black bg-black text-3xl text-neo-secondary">
            <FaCrown />
          </span>
        )}
        {d.rematchDue && (
          <span className="absolute -bottom-6 -left-5 grid h-12 w-12 place-items-center border-4 border-black bg-neo-accent text-2xl text-white">
            <FaKhanda />
          </span>
        )}
      </motion.div>
    );
  }

  // ---- full card ----
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={animate}
      whileHover={interactive ? { scale: 1.06, y: -5, rotate: d.current ? -1.5 : 1.2 } : { y: -2 }}
      whileTap={interactive ? { scale: 0.93, rotate: 0 } : {}}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      className={`${base} flex flex-col justify-between p-2 pt-3 shadow-neo-sm ${
        d.current ? "!bg-neo-accent !shadow-neo z-10" : STATUS_STYLE[d.status]
      }`}
      style={{ width: SQ_W, height: SQ_H }}
    >
      {glow}
      {currentRing}
      <Handles />

      {/* difficulty strip */}
      <div className="absolute inset-x-0 top-0 h-2 border-b-2 border-black" style={{ background: diffHex }} />

      {/* elo ribbon */}
      <div className="absolute -right-2.5 -top-3 z-20 flex -rotate-3 items-stretch border-2 border-black bg-black shadow-neo-sm transition-transform duration-150 group-hover:rotate-0 group-hover:scale-110">
        <span className="grid place-items-center px-1" style={{ background: diffHex }}>
          <FaBolt className="text-[9px] text-black" />
        </span>
        <span className="px-1.5 py-0.5 text-[11px] font-black tabular-nums leading-none text-white">{d.elo}</span>
      </div>

      <div className="relative z-[1] mt-1 flex items-start gap-1.5 pr-6">
        <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center border-2 border-black bg-white text-[10px]">
          {d.locked ? <FaLock className="opacity-50" /> : <StatusIcon status={d.status} current={d.current} className={d.current ? "text-neo-accent" : ""} />}
        </span>
        <span className="text-[12px] font-black uppercase leading-tight line-clamp-2">{d.title}</span>
      </div>

      {/* one icon row: difficulty · modifier · aura */}
      <div className="relative z-[1] flex items-center gap-1">
        <span
          className="flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-[9px] font-black uppercase text-black"
          style={{ background: diffHex }}
        >
          {DIFF_ICON[d.difficulty] ?? <FaCircle />} {d.difficulty}
        </span>
        {d.modifier && (
          <span
            title={`${MODIFIER_META[d.modifier].label} — ${MODIFIER_META[d.modifier].desc}`}
            className={`grid h-[22px] w-[22px] place-items-center border-2 border-black text-[10px] ${MODIFIER_BG[d.modifier]}`}
          >
            {MODIFIER_ICON[d.modifier]}
          </span>
        )}
        {d.aura && (
          <span
            title={`${AURA_META[d.aura].label} — ${AURA_META[d.aura].desc} (rotates daily)`}
            className="grid h-[22px] w-[22px] place-items-center border-2 border-black text-[11px]"
            style={{ background: AURA_META[d.aura].color, color: AURA_META[d.aura].text }}
          >
            {AURA_META[d.aura].icon}
          </span>
        )}
        <span className="ml-auto truncate text-[8px] font-bold uppercase opacity-60" title={d.topics}>
          {d.topics.split(" · ")[0]}
        </span>
      </div>

      {d.rematchDue && (
        <div
          title="Rematch due — beat it this time"
          className="node-bob absolute -bottom-3 -left-3 z-20 grid h-7 w-7 place-items-center border-4 border-black bg-neo-accent text-[12px] text-white shadow-neo-sm"
        >
          <FaKhanda />
        </div>
      )}

      {d.boss && (
        <div
          title="Boss node — clear it to breach the next act (guaranteed relic chest)"
          className="absolute -top-6 left-1/2 z-20 grid h-8 w-8 -translate-x-1/2 place-items-center border-4 border-black bg-black text-[14px] text-neo-secondary shadow-neo-sm"
        >
          <FaCrown />
        </div>
      )}
    </motion.div>
  );
}

export const SquareNode = memo(SquareNodeImpl);
