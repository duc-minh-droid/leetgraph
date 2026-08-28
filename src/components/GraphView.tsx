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
} from "react-icons/fa6";
import { type MapData, type MapNode } from "../map";
import { type Problem } from "../data/problems";
import { deriveNodeStatus, type NodeStatus } from "../state/nodeState";
import { addAttempt, touchedSlugs, type Attempt, type AttemptResult, type FailureMode } from "../state/attempts";
import type { MapMeta } from "../state/library";

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
}

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
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.07, rotate: d.current ? -2 : 1.5 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      className={`relative flex flex-col justify-between overflow-visible border-4 border-black p-2 shadow-neo-sm ${
        d.future ? "opacity-60" : statusCls
      } ${d.current ? "!bg-neo-accent !text-black !shadow-neo z-10" : ""} ${
        d.future ? "cursor-not-allowed" : d.available ? "cursor-pointer" : "cursor-default"
      }`}
      style={{ width: SQ_W, height: SQ_H }}
    >
      <Handle id="top-0" type="source" position={Position.Top} isConnectable={false} style={{ left: "16.6%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="top-1" type="source" position={Position.Top} isConnectable={false} style={{ left: "50%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="top-2" type="source" position={Position.Top} isConnectable={false} style={{ left: "83.3%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom-0" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "16.6%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom-1" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "50%", opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom-2" type="target" position={Position.Bottom} isConnectable={false} style={{ left: "83.3%", opacity: 0, pointerEvents: "none" }} />

      <div className="absolute left-1 top-1 grid h-6 w-6 place-items-center border-2 border-black bg-white">
        <StatusBadge status={d.status} current={d.current} />
      </div>

      <div className={`absolute -right-2 -top-3 z-20 flex rotate-6 items-center gap-0.5 border-4 border-black ${diffRibbon} px-1.5 py-0.5 text-[11px] font-black shadow-neo-sm`}>
        <FaBolt className="text-[10px]" /> {d.elo}
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
      </div>
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
  ];
  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="pointer-events-none absolute bottom-4 left-4 z-20 rotate-[-1deg] border-4 border-black bg-white p-3 shadow-neo"
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
  onClose,
  onSubmit,
}: {
  problem: Problem;
  startTime: number;
  onClose: () => void;
  onSubmit: (a: Attempt) => void;
}) {
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
            <FaBolt className="text-neo-accent" /> {problem.title}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`neo-tag ${DIFF_STYLE[problem.difficulty] ?? "bg-neo-secondary text-black"}`}>
              {problem.difficulty}
            </span>
            <span className="neo-tag bg-white">
              <FaBolt /> {problem.elo}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-black/70">
            <FaFire /> {problem.topics.join(", ")}
          </div>
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

      <label className="flex flex-col gap-1.5 text-sm font-bold uppercase tracking-wide">
        <span className="flex items-center gap-1">
          <FaCircleCheck className="text-neo-ok" /> Result
        </span>
        <select
          className="neo-input"
          value={result}
          onChange={(e) => setResult(e.target.value as AttemptResult)}
        >
          <option value="solved">Solved</option>
          <option value="solved_with_help">Solved with help</option>
          <option value="gave_up">Gave up</option>
          <option value="abandoned">Abandoned mid-attempt</option>
        </select>
      </label>

      {isFailure && (
        <label className="flex flex-col gap-1.5 text-sm font-bold uppercase tracking-wide">
          <span className="flex items-center gap-1">
            <FaXmark className="text-neo-accent" /> Failure mode
          </span>
          <select
            className="neo-input"
            value={failureMode}
            onChange={(e) => setFailureMode(e.target.value as FailureMode | "")}
          >
            <option value="">— not specified —</option>
            <option value="wrong-answer">Wrong answer</option>
            <option value="tle">Time limit exceeded</option>
            <option value="runtime-error">Runtime error</option>
            <option value="compile-error">Compile error</option>
          </select>
        </label>
      )}

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

      <div className="flex flex-col gap-2 border-4 border-black bg-white p-3 shadow-neo-sm">
        {(
          [
            { label: "Used hints", val: hints, setter: setHints, icon: <FaLightbulb key="h" className="text-neo-orange" /> },
            { label: "Used AI", val: ai, setter: setAi, icon: <FaRobot key="a" className="text-neo-pink" /> },
            { label: "Verified syntax", val: verified, setter: setVerified, icon: <FaShieldHalved key="v" className="text-neo-blue" /> },
          ] as { label: string; val: boolean; setter: (b: boolean) => void; icon: ReactNode }[]
        ).map(({ label, val, setter, icon }) => (
          <label key={label} className="flex items-center gap-2 text-xs font-bold uppercase">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => setter(e.target.checked)}
              className="h-5 w-5 accent-[#FF6B6B]"
            />
            {icon} {label}
          </label>
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
          onSubmit({
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
          })
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
}: {
  map: MapMeta;
  viewAct: number;
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

  const available = useMemo(() => {
    if (current === null) return data.filter((n) => n.row === 0).map((n) => n.id);
    return data.find((n) => n.id === current)?.edges_out ?? [];
  }, [data, current]);

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
            } as SquareData,
          };
        }),
    [data, pos, available, visited, current, viewAct]
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

  function open(id: string) {
    if (!available.includes(id)) return;
    setSelected(id);
    setStartTime(Date.now());
  }

  function submitReport(a: Attempt) {
    if (!selected) return;
    const slug = data.find((n) => n.id === selected)!.slug;
    addAttempt(slug, { ...a, at: Date.now() });
    setVisited((prev) => new Set(prev).add(selected));
    setCurrent(selected);
    setSelected(null);
  }

  const selectedNode = selected ? data.find((n) => n.id === selected) : null;
  const selectedProblem = selectedNode ? bySlug[selectedNode.slug] : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col p-3 md:p-5">
      <div
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
      </div>

      <AnimatePresence>
        {selectedProblem && (
          <ReportPanel
            problem={selectedProblem}
            startTime={startTime}
            onClose={() => setSelected(null)}
            onSubmit={submitReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
