import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  type CoordinateExtent,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MapData, MapNode } from "../map";
import { deriveNodeStatus, type NodeStatus } from "../state/nodeState";
import { touchedSlugs, type Attempt } from "../state/attempts";
import { currentStreak } from "../state/analytics";
import { submitAttempt } from "../state/progress";
import { dueReviews, type ReviewItem } from "../state/reviews";
import { modifierOf } from "../state/modifiers";
import { RANKS } from "../state/rating";
import { emitCoach } from "../state/coachBus";
import { mysteryPending, isMysteryNode } from "../state/events";
import { auraOf } from "../state/auras";
import { getInventory, type Inventory } from "../state/inventory";
import type { MapMeta } from "../state/library";
import { Celebration, type CelebrationData } from "./Celebration";
import { EventModal, ChestModal, BossIntro, Belt, RankUpCeremony, ActClearBanner } from "./Loot";
import { MapWeather } from "./MapWeather";
import { useCoachHidden } from "./Coach";
import { sfx } from "../lib/sfx";
import {
  burst,
  ring,
  shake,
  flash,
  blink,
  floatText,
  flyTo,
  hitstop,
  pointOf,
  reduceFx,
  registerShakeTarget,
  NEO,
} from "../lib/juice";
import { useIsMobile } from "../lib/useMedia";
import { layout, boundsOf, SQ_W, SQ_H } from "./graph/layout";
import { SquareNode, DIFF_HEX, type SquareData } from "./graph/SquareNode";
import { ReportPanel, REPORT_W } from "./graph/ReportPanel";
import { MapControls } from "./graph/MapControls";
import { RunDock } from "./graph/RunDock";
import { ActBar } from "./graph/ActBar";

const nodeTypes = { square: SquareNode };
const EXTENT_PAD = 520;
const FOCUS_ZOOM_DESKTOP = 0.9;
const FOCUS_ZOOM_MOBILE = 0.62;

interface Props {
  map: MapMeta;
  viewAct: number;
  maxAct: number;
  totalActs: number;
  progress: number;
  onViewAct: (a: number) => void;
  onAttempt?: () => void;
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}

function nodeEl(id: string): Element | null {
  return document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
}

function GraphInner({ map, viewAct, maxAct, totalActs, progress, onViewAct, onAttempt }: Props) {
  const data: MapData = map.nodes;
  const bySlug = map.problems;
  const rf = useReactFlow();
  const mobile = useIsMobile();
  const FOCUS_ZOOM = mobile ? FOCUS_ZOOM_MOBILE : FOCUS_ZOOM_DESKTOP;

  // Resume from the attempt log (persisted) — refresh never loses your place.
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
  const [inv, setInv] = useState<Inventory>(() => getInventory());
  const [eventNode, setEventNode] = useState<string | null>(null);
  const [blindAttempt, setBlindAttempt] = useState(false);
  const [bossIntroFor, setBossIntroFor] = useState<string | null>(null);
  const [rankUpTo, setRankUpTo] = useState<string | null>(null);
  const [actClear, setActClear] = useState<number | null>(null);
  const [attemptsRev, setAttemptsRev] = useState(0);
  const [rematchSlug, setRematchSlug] = useState<string | null>(null);
  // Juice state: just-unlocked nodes (stagger index) + the node that was just hit.
  const [fresh, setFresh] = useState<Map<string, number>>(() => new Map());
  const [stamp, setStamp] = useState<{ id: string; n: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    registerShakeTarget(wrapRef.current);
    return () => registerShakeTarget(null);
  }, []);

  const mapSlugs = useMemo(() => new Set(data.map((n) => n.slug)), [data]);
  const due: ReviewItem[] = useMemo(() => {
    void attemptsRev;
    return dueReviews(mapSlugs);
  }, [mapSlugs, attemptsRev]);
  const dueSet = useMemo(() => new Set(due.map((r) => r.slug)), [due]);

  const pos = useMemo(() => layout(data), [data]);
  const byId = useMemo(() => new Map(data.map((n) => [n.id, n])), [data]);

  // Per-act row span + start/end node ids.
  const actInfo = useMemo(() => {
    const total = Math.max(...data.map((n) => n.act)) + 1;
    const info: { startRow: number; endRow: number; startId: string; endId: string; ids: string[] }[] = [];
    for (let a = 0; a < total; a++) {
      const inAct = data.filter((n) => n.act === a);
      const startRow = Math.min(...inAct.map((n) => n.row));
      const endRow = Math.max(...inAct.map((n) => n.row));
      info.push({
        startRow,
        endRow,
        startId: inAct.find((n) => n.row === startRow)!.id,
        endId: inAct.find((n) => n.row === endRow)!.id,
        ids: inAct.map((n) => n.id),
      });
    }
    return info;
  }, [data]);

  const actBounds = useMemo(() => boundsOf(actInfo[viewAct].ids, pos), [actInfo, viewAct, pos]);
  const extent: CoordinateExtent = useMemo(
    () => [
      [actBounds.x - EXTENT_PAD, actBounds.y - EXTENT_PAD],
      [actBounds.x + actBounds.width + EXTENT_PAD, actBounds.y + actBounds.height + EXTENT_PAD],
    ],
    [actBounds]
  );

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

  // Untouched nodes unlock once ANY parent has been attempted (entry row is open).
  const available = useMemo(
    () =>
      new Set(
        data
          .filter((n) => {
            if (visited.has(n.id)) return false;
            if (n.row === 0) return true;
            return (inEdges.get(n.id) ?? []).some((p) => visited.has(p));
          })
          .map((n) => n.id)
      ),
    [data, visited, inEdges]
  );

  const statusOf = useCallback(
    (n: MapNode): NodeStatus => {
      const st = deriveNodeStatus(n.slug);
      if (st === "unseen" && available.has(n.id)) return "in_progress";
      return st;
    },
    [available]
  );

  const actProgress = useMemo(() => {
    void attemptsRev;
    return actInfo.map((a) => {
      const done = a.ids.filter((id) => {
        const st = deriveNodeStatus(byId.get(id)!.slug);
        return st === "solved" || st === "solved_with_help";
      }).length;
      return a.ids.length ? done / a.ids.length : 0;
    });
  }, [actInfo, byId, attemptsRev]);

  // ---------------- camera ----------------

  const panelOpen = Boolean(selected || rematchSlug);

  const nextTarget = useCallback((): string => {
    const ids = actInfo[viewAct].ids;
    const cur = current && byId.get(current)?.act === viewAct ? current : null;
    const avail = ids.filter((id) => available.has(id));
    if (avail.length) {
      const origin = cur ? pos.get(cur)! : pos.get(actInfo[viewAct].startId)!;
      avail.sort((a, b) => {
        const ra = byId.get(a)!.row;
        const rb = byId.get(b)!.row;
        if (ra !== rb) return ra - rb;
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        return Math.hypot(pa.x - origin.x, pa.y - origin.y) - Math.hypot(pb.x - origin.x, pb.y - origin.y);
      });
      return avail[0];
    }
    return cur ?? actInfo[viewAct].startId;
  }, [actInfo, viewAct, current, byId, available, pos]);

  const focusNode = useCallback(
    (id: string, opts: { zoom?: number; duration?: number; panel?: boolean } = {}) => {
      const p = pos.get(id);
      if (!p) return;
      const z = opts.zoom ?? Math.max(rf.getZoom(), FOCUS_ZOOM);
      const withPanel = (opts.panel ?? panelOpen) && !mobile;
      const offset = withPanel ? REPORT_W / 2 / z : 0;
      const dy = mobile && (opts.panel ?? panelOpen) ? window.innerHeight * 0.22 / z : 0;
      void rf.setCenter(p.x + offset, p.y + dy, { zoom: z, duration: reduceFx() ? 0 : opts.duration ?? 600 });
    },
    [pos, rf, panelOpen, mobile, FOCUS_ZOOM]
  );

  const fitAct = useCallback(
    (duration = 600) => {
      void rf.fitBounds(actBounds, { padding: 0.08, duration: reduceFx() ? 0 : duration });
    },
    [rf, actBounds]
  );

  const jumpNext = useCallback(
    () => focusNode(nextTarget(), { zoom: Math.max(rf.getZoom(), FOCUS_ZOOM) }),
    [focusNode, nextTarget, rf, FOCUS_ZOOM]
  );

  // Intro + act switches: zoom out to the whole act, then dive to the next node.
  useEffect(() => {
    if (!didInit.current) return;
    fitAct(550);
    const t = setTimeout(() => focusNode(nextTarget(), { zoom: FOCUS_ZOOM, duration: 750, panel: false }), 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewAct]);

  const onInit = () => {
    didInit.current = true;
    void rf.fitBounds(actBounds, { padding: 0.08, duration: 0 });
    setTimeout(() => focusNode(nextTarget(), { zoom: FOCUS_ZOOM, duration: 1000, panel: false }), 420);
  };

  // ---------------- flow elements ----------------

  const rfNodes: Node[] = useMemo(
    () =>
      actInfo[viewAct].ids.map((id) => {
        const n = byId.get(id)!;
        const p = pos.get(id)!;
        const prob = bySlug[n.slug];
        return {
          id,
          type: "square",
          position: { x: p.x - SQ_W / 2, y: p.y - SQ_H / 2 },
          // Explicit size: controlled nodes never get `measured` written back,
          // and the minimap needs dimensions to draw them.
          width: SQ_W,
          height: SQ_H,
          data: {
            available: available.has(id),
            visited: visited.has(id),
            current: current === id,
            status: statusOf(n),
            title: prob?.title ?? n.slug,
            elo: prob?.elo ?? 0,
            difficulty: prob?.difficulty ?? "",
            topics: (prob?.topics ?? []).join(" · "),
            act: n.act,
            locked: !visited.has(id) && !available.has(id),
            modifier: modifierOf(n.slug),
            rematchDue: dueSet.has(n.slug),
            mystery: isMysteryNode(n.slug) && !inv.eventsSeen.includes(n.slug) && !visited.has(id),
            boss: n.row === actInfo[n.act].endRow,
            aura: auraOf(n.slug),
            fresh: fresh.get(id) ?? 0,
            stamp: stamp?.id === id ? stamp.n : 0,
          } as SquareData,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actInfo, viewAct, byId, pos, bySlug, available, visited, current, dueSet, inv, fresh, stamp, attemptsRev]
  );

  const portOf = useCallback(
    (from: string, to: string) => {
      const a = pos.get(from)!;
      const b = pos.get(to)!;
      const fn = byId.get(from)!;
      const sources = inEdges.get(to) ?? [];
      const dir = (dx: number) => (dx < 0 ? 0 : dx > 0 ? 2 : 1);
      return {
        fromIdx: fn.edges_out.length === 1 ? 1 : dir(b.x - a.x),
        toIdx: sources.length === 1 ? 1 : dir(a.x - b.x),
      };
    },
    [pos, byId, inEdges]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      actInfo[viewAct].ids.flatMap((id) => {
        const n = byId.get(id)!;
        return n.edges_out
          .filter((tid) => byId.get(tid)?.act === viewAct)
          .map((tid) => {
            const { fromIdx, toIdx } = portOf(id, tid);
            const cls = visited.has(id) && visited.has(tid)
              ? "edge solved"
              : visited.has(id) && available.has(tid)
                ? `edge open${fresh.has(tid) ? " fresh" : ""}`
                : "edge locked";
            return {
              id: `${id}-${tid}`,
              source: id,
              target: tid,
              sourceHandle: `top-${fromIdx}`,
              targetHandle: `bottom-${toIdx}`,
              type: "default",
              className: cls,
            } as Edge;
          });
      }),
    [actInfo, viewAct, byId, portOf, visited, available, fresh]
  );

  const isBossId = useCallback(
    (id: string): boolean => {
      const n = byId.get(id);
      return Boolean(n && n.row === actInfo[n.act].endRow);
    },
    [byId, actInfo]
  );

  // ---------------- interactions ----------------

  function openPanel(id: string, blind = false) {
    setBlindAttempt(blind);
    setSelected(id);
    setStartTime(Date.now());
    const slug = byId.get(id)?.slug;
    emitCoach({ type: "opened", title: blind ? "a mystery" : (slug && bySlug[slug]?.title) || "this one" });
    focusNode(id, { panel: true, duration: 500 });
  }

  function open(id: string) {
    if (!available.has(id)) {
      // Locked/visited nodes still give feedback.
      const el = nodeEl(id);
      if (el && !visited.has(id)) {
        (el as HTMLElement).animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
          { duration: 220 }
        );
        sfx("error", 0.2);
      }
      return;
    }
    const slug = byId.get(id)!.slug;
    const el = nodeEl(id);
    if (el) {
      const p = pointOf(el);
      ring(p.x, p.y, "#000", 200);
    }
    if (mysteryPending(slug)) {
      setEventNode(id);
    } else if (isBossId(id)) {
      setBossIntroFor(id);
      emitCoach({ type: "interview-start" });
    } else {
      openPanel(id);
    }
  }

  const lastHover = useRef(0);
  const onHover = (id: string) => {
    if (!available.has(id)) return;
    const t = performance.now();
    if (t - lastHover.current < 90) return;
    lastHover.current = t;
    sfx("click", 0.06);
  };

  async function submitReport(a: Attempt, opts: { secondChance: boolean }) {
    const slug = rematchSlug ?? (selected ? byId.get(selected)!.slug : null);
    if (!slug) return;
    const nodeId = selected && !rematchSlug ? selected : (data.find((n) => n.slug === slug && n.act === viewAct)?.id ?? null);
    const boss = Boolean(selected && !rematchSlug && isBossId(selected));
    const outcome = submitAttempt(
      slug,
      { ...a, at: Date.now() },
      { secondChance: opts.secondChance, isBossNode: boss, difficulty: bySlug[slug]?.difficulty }
    );
    const solved = a.result === "solved" || a.result === "solved_with_help";

    // Close the panel first so the camera + effects play on a clear map.
    const wasSelected = selected && !rematchSlug ? selected : null;
    setSelected(null);
    setRematchSlug(null);
    setBlindAttempt(false);

    // Audio, layered by significance.
    if (a.result === "solved") sfx(outcome.crit ? "crit" : "solved");
    else if (a.result === "solved_with_help") sfx("assisted");
    else sfx("failed", 0.4);
    if (outcome.curseGained) sfx("curse", 0.5);
    if (outcome.leveledUp) setTimeout(() => sfx("levelUp", 0.6), 500);
    if (outcome.newAchievements.length > 0) setTimeout(() => sfx("achievement", 0.5), 800);
    if (outcome.questJustCompleted) setTimeout(() => sfx("quest", 0.5), 1100);
    if (outcome.promoLost || outcome.rankDown) setTimeout(() => sfx(outcome.rankDown ? "rankDown" : "promoLost", 0.5), 700);

    // Newly unlocked children of the attempted node.
    let freshIds: string[] = [];
    if (wasSelected) {
      freshIds = byId.get(wasSelected)!.edges_out.filter((t) => !visited.has(t) && !available.has(t) && t !== wasSelected);
      setVisited((prev) => new Set(prev).add(wasSelected));
      setCurrent(wasSelected);
      setFresh(new Map(freshIds.map((id, i) => [id, i + 1])));
    }
    if (nodeId) setStamp({ id: nodeId, n: Date.now() });
    setAttemptsRev((r) => r + 1);
    setInv(getInventory());

    // ---- juice ----
    const el = nodeId ? nodeEl(nodeId) : null;
    const pt = el ? pointOf(el) : pointOf(wrapRef.current);
    const diff = DIFF_HEX[bySlug[slug]?.difficulty ?? ""] ?? "#FFD93D";
    if (solved) {
      if (outcome.crit) {
        await hitstop(90);
        blink("#fff", 0.75);
      }
      burst(pt.x, pt.y, { colors: [diff, ...NEO], count: outcome.crit ? 64 : 34, speed: outcome.crit ? 820 : 560 });
      ring(pt.x, pt.y, diff, outcome.crit ? 320 : 220);
      shake(outcome.crit ? 1.7 : boss ? 1.25 : 0.45);
    } else {
      burst(pt.x, pt.y, { colors: ["#000", "#9aa0a6", "#FF6B6B"], count: 18, speed: 380, shape: "shard", gravity: 1400 });
      flash("#FF6B6B", 0.5);
      shake(0.7);
    }
    if (outcome.ratingDelta !== 0) {
      floatText(pt.x, pt.y - 60, `${outcome.ratingDelta > 0 ? "+" : ""}${outcome.ratingDelta}`, {
        bg: outcome.ratingDelta > 0 ? "#4ADE80" : "#FF6B6B",
        color: outcome.ratingDelta > 0 ? "#000" : "#fff",
        size: 22,
      });
    }
    if (outcome.xpEarned > 0) floatText(pt.x + 46, pt.y - 24, `+${outcome.xpEarned} XP`, { bg: "#4D96FF", color: "#fff", size: 13, delay: 160 });
    if (outcome.coinsEarned > 0) {
      setTimeout(
        () => flyTo(pt, "#hud-coins", { html: "¢", count: Math.min(10, Math.ceil(outcome.coinsEarned / 4)) }),
        320
      );
    }

    // Camera nudge toward what just opened up.
    if (freshIds.length) {
      setTimeout(() => {
        const pts = freshIds.map((id) => pos.get(id)!).filter(Boolean);
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        void rf.setCenter(cx, cy - 40, { zoom: rf.getZoom(), duration: reduceFx() ? 0 : 900 });
      }, 650);
    }
    setTimeout(() => {
      setFresh(new Map());
      setStamp(null);
    }, 2200);

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
      farmed: outcome.farmed,
      rankDown: outcome.rankDown,
      xpEarned: outcome.xpEarned,
      levelUp: outcome.leveledUp,
      coinsEarned: outcome.coinsEarned,
      relicsGained: outcome.relicsGained,
      promoNote: outcome.promoLost
        ? "PROMO SERIES LOST — −10 rating"
        : outcome.promoArmed && outcome.promo
          ? `PROMO SERIES: win 2 of 3 for ${RANKS[outcome.promo.target].name}!`
          : outcome.promo
            ? `PROMOS: ${outcome.promo.wins}W–${outcome.promo.losses}L`
            : null,
    });
    if (boss && solved && wasSelected) setActClear(byId.get(wasSelected)!.act);
    if (outcome.rankUp) setRankUpTo(outcome.rankUp);
    if (outcome.newAchievements.length > 0) emitCoach({ type: "achievement", name: outcome.newAchievements[0].name });
    else if (a.result === "solved") emitCoach({ type: "solved", clean: !a.hints && !a.ai });
    else if (a.result === "solved_with_help") emitCoach({ type: "assisted" });
    else emitCoach({ type: "failed" });
    onAttempt?.();
  }

  const closePanel = useCallback(() => {
    setSelected(null);
    setRematchSlug(null);
    setBlindAttempt(false);
  }, []);
  const endCelebration = useCallback(() => setCelebration(null), []);
  const endActClear = useCallback(() => setActClear(null), []);

  // ---------------- keyboard ----------------

  const modalOpen = Boolean(eventNode || bossIntroFor || celebration || rankUpTo || actClear !== null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (panelOpen || modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const vp = rf.getViewport();
      const step = 140;
      const pan = (dx: number, dy: number) => {
        e.preventDefault();
        void rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 140 });
      };
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          return pan(0, step);
        case "ArrowDown":
        case "s":
        case "S":
          return pan(0, -step);
        case "ArrowLeft":
        case "a":
        case "A":
          return pan(step, 0);
        case "ArrowRight":
        case "d":
        case "D":
          return pan(-step, 0);
        case "+":
        case "=":
          return void rf.zoomIn({ duration: 200 });
        case "-":
        case "_":
          return void rf.zoomOut({ duration: 200 });
        case "f":
        case "F":
          return fitAct();
        case "n":
        case "N":
          return jumpNext();
        case "[":
          if (viewAct > 0) onViewAct(viewAct - 1);
          return;
        case "]":
          if (viewAct < maxAct) onViewAct(viewAct + 1);
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rf, panelOpen, modalOpen, fitAct, jumpNext, viewAct, maxAct, onViewAct]);

  const selectedNode = selected ? byId.get(selected) : null;
  const selectedProblem = rematchSlug ? (bySlug[rematchSlug] ?? null) : selectedNode ? bySlug[selectedNode.slug] : null;
  useCoachHidden("report", Boolean(selectedProblem));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-neo-bg"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("react-flow__pane")) fitAct();
        }}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => open(node.id)}
          onNodeMouseEnter={(_, node) => onHover(node.id)}
          onInit={onInit}
          minZoom={0.2}
          maxZoom={1.3}
          translateExtent={extent}
          panOnScroll
          panOnScrollSpeed={0.9}
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          zoomActivationKeyCode={["Control", "Meta"]}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} gap={40} color="rgba(0,0,0,0.08)" />
          <MapControls onFit={() => fitAct()} onNext={jumpNext} />
        </ReactFlow>

        {!reduceFx() && <MapWeather mapId={map.id} />}

        <ActBar viewAct={viewAct} maxAct={maxAct} actProgress={actProgress} overall={progress} onViewAct={onViewAct} />

        <Belt
          inv={inv}
          onChanged={() => {
            setInv(getInventory());
            onAttempt?.();
          }}
        />

        <RunDock
          rev={attemptsRev}
          due={due}
          problems={bySlug}
          onClaim={() => {
            setAttemptsRev((r) => r + 1);
            setInv(getInventory());
            onAttempt?.();
          }}
          onPickRematch={(slug) => {
            setRematchSlug(slug);
            setSelected(null);
            setStartTime(Date.now());
            const id = data.find((n) => n.slug === slug && n.act === viewAct)?.id;
            if (id) focusNode(id, { panel: true });
          }}
        />

        {/* ---- overlay queue: event/boss → celebration → act clear → rank up → chest ---- */}
        <AnimatePresence>
          {eventNode && (
            <EventModal
              slug={byId.get(eventNode)!.slug}
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
              title={bySlug[byId.get(bossIntroFor)!.slug]?.title ?? "The Gatekeeper"}
              onDone={() => {
                const id = bossIntroFor;
                setBossIntroFor(null);
                if (id) openPanel(id);
              }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>{celebration && <Celebration data={celebration} onDone={endCelebration} />}</AnimatePresence>
        <AnimatePresence>
          {actClear !== null && !celebration && (
            <ActClearBanner act={actClear} final={actClear >= totalActs - 1} onDone={endActClear} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {rankUpTo && !celebration && actClear === null && (
            <RankUpCeremony rankName={rankUpTo} onDone={() => setRankUpTo(null)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {inv.pendingChest && !celebration && actClear === null && !rankUpTo && (
            <ChestModal
              onDone={(relic) => {
                setInv(getInventory());
                if (relic) emitCoach({ type: "achievement", name: relic.name });
                onAttempt?.();
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedProblem && (
          <ReportPanel
            key={selectedProblem.slug}
            problem={selectedProblem}
            startTime={startTime}
            blind={blindAttempt}
            canSecondChance={inv.potions.includes("second-chance")}
            onClose={closePanel}
            onSubmit={submitReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
