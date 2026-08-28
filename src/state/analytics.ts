import { getAllAttempts, type Attempt, type AttemptResult, type FailureMode } from "./attempts";
import { PROBLEM_BY_SLUG, type Problem } from "../data/problems";

export type { FailureMode, AttemptResult };

// Canonical pattern axes for the radar chart — the high-signal LeetCode tags
// called out in the spec, in a stable order. Other tags still appear in the
// heatmap; this list just decides radar priority/ordering.
const CANONICAL_PATTERNS = [
  "Array",
  "Two Pointers",
  "Sliding Window",
  "Hash Table",
  "String",
  "Binary Search",
  "Dynamic Programming",
  "Greedy",
  "Heap (Priority Queue)",
  "Stack",
  "Tree",
  "Binary Tree",
  "Graph Theory",
  "Backtracking",
  "Prefix Sum",
  "Linked List",
];

export interface EnrichedAttempt {
  slug: string;
  title: string;
  elo: number;
  difficulty: string;
  topics: string[];
  result: AttemptResult;
  failureMode: FailureMode | null;
  solved: boolean;
  hints: boolean;
  ai: boolean;
  verified: boolean;
  note: string;
  at: number;
  readTime: number;
  writeTime: number;
  debugTime: number;
  totalTime: number;
  optimal: boolean;
  timeComplexity: string;
  spaceComplexity: string;

  // --- Derived session context ---
  attemptIndex: number; // global chronological index (0-based)
  nodeOrdinal: number; // Nth attempt within its calendar day (fatigue signal)
  streakDay: number; // consecutive-day streak (1-based) this attempt belongs to
  retryGapDays: number | null; // days since previous attempt on same node
  firstTry: boolean; // first attempt on node AND solved
  attemptsOnNode: number; // 1-based position within this node's attempt list
  eventuallyCorrect: boolean; // node was solved at or before this attempt
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayDiff(aMs: number, bMs: number): number {
  const a = new Date(aMs);
  const b = new Date(bMs);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function getEnrichedAttempts(
  filterSlugs?: Set<string>,
  lookup: Record<string, Problem> = PROBLEM_BY_SLUG
): EnrichedAttempt[] {
  const log = getAllAttempts();
  const flat: { slug: string; attempt: Attempt; at: number }[] = [];
  for (const [slug, attempts] of Object.entries(log)) {
    if (filterSlugs && !filterSlugs.has(slug)) continue;
    for (const a of attempts) flat.push({ slug, attempt: a, at: a.at });
  }
  flat.sort((x, y) => x.at - y.at);

  // Per-slug attempt bookkeeping for first-try / attempts-on-node / retry-gap.
  const bySlug: Record<string, { solvedBefore: boolean; prevAt: number | null; count: number }> = {};
  // Streak + per-day ordinal.
  let prevDay: string | null = null;
  let streak = 0;
  const dayOrdinal: Record<string, number> = {};

  return flat.map(({ slug, attempt }, i) => {
    const p: Problem | undefined = lookup[slug];
    const solved = attempt.result === "solved" || attempt.result === "solved_with_help";

    // streak
    const dk = dayKey(attempt.at);
    if (dk !== prevDay) {
      if (prevDay !== null && dayDiff(attempt.at, new Date(prevDay + "T00:00:00").getTime()) === 1) {
        streak += 1;
      } else {
        streak = 1;
      }
      prevDay = dk;
    }
    dayOrdinal[dk] = (dayOrdinal[dk] ?? 0) + 1;
    const nodeOrdinal = dayOrdinal[dk];

    const rec = bySlug[slug] ?? { solvedBefore: false, prevAt: null, count: 0 };
    rec.count += 1;
    const attemptsOnNode = rec.count;
    const firstTry = solved && attemptsOnNode === 1;
    const retryGapDays = rec.prevAt === null ? null : Math.max(0, dayDiff(attempt.at, rec.prevAt));
    const eventuallyCorrect = rec.solvedBefore || solved;

    rec.solvedBefore = rec.solvedBefore || solved;
    rec.prevAt = attempt.at;
    bySlug[slug] = rec;

    const readTime = attempt.readTime ?? 0;
    const writeTime = attempt.writeTime ?? 0;
    const debugTime = attempt.debugTime ?? 0;
    const totalTime = attempt.time || readTime + writeTime + debugTime;

    return {
      slug,
      title: p?.title ?? slug,
      elo: p?.elo ?? 0,
      difficulty: p?.difficulty ?? "?",
      topics: p?.topics ?? [],
      result: attempt.result,
      failureMode: attempt.failureMode ?? null,
      solved,
      hints: attempt.hints,
      ai: attempt.ai,
      verified: attempt.verified,
      note: attempt.note,
      at: attempt.at,
      readTime,
      writeTime,
      debugTime,
      totalTime,
      optimal: attempt.optimal ?? false,
      timeComplexity: attempt.timeComplexity ?? "",
      spaceComplexity: attempt.spaceComplexity ?? "",
      attemptIndex: i,
      nodeOrdinal,
      streakDay: streak,
      retryGapDays,
      firstTry,
      attemptsOnNode,
      eventuallyCorrect,
    };
  });
}

// ---------------- Chart data builders ----------------

export interface EloPoint {
  i: number;
  elo: number;
  title: string;
  at: number;
  trend: number | null;
}

// Headline "am I getting better" line: solved attempts' elo over time + a
// rolling-average trend line.
export function eloOverTime(data: EnrichedAttempt[]): EloPoint[] {
  const solved = data.filter((d) => d.solved);
  const window = 5;
  return solved.map((d, idx) => {
    const start = Math.max(0, idx - window + 1);
    const slice = solved.slice(start, idx + 1);
    const trend = Math.round(slice.reduce((s, x) => s + x.elo, 0) / slice.length);
    return { i: idx + 1, elo: d.elo, title: d.title, at: d.at, trend };
  });
}

export interface RadarPoint {
  topic: string;
  solveRate: number; // 0..100
  avgElo: number; // avg elo of solved attempts in this tag
  attempts: number;
}

// One axis per pattern: solve rate in that tag (+ avg solved elo for tooltip).
export function patternRadar(data: EnrichedAttempt[]): RadarPoint[] {
  const acc: Record<string, { total: number; solved: number; eloSum: number }> = {};
  for (const d of data) {
    for (const t of d.topics) {
      const a = (acc[t] ??= { total: 0, solved: 0, eloSum: 0 });
      a.total += 1;
      if (d.solved) {
        a.solved += 1;
        a.eloSum += d.elo;
      }
    }
  }
  const order = [
    ...CANONICAL_PATTERNS.filter((t) => acc[t]),
    ...Object.keys(acc).filter((t) => !CANONICAL_PATTERNS.includes(t)),
  ];
  return order.map((topic) => {
    const a = acc[topic];
    return {
      topic,
      solveRate: a.total ? Math.round((a.solved / a.total) * 100) : 0,
      avgElo: a.solved ? Math.round(a.eloSum / a.solved) : 0,
      attempts: a.total,
    };
  });
}

export const ELO_BANDS: { label: string; lo: number; hi: number }[] = [
  { label: "<1000", lo: 0, hi: 1000 },
  { label: "1000-1200", lo: 1000, hi: 1200 },
  { label: "1200-1400", lo: 1200, hi: 1400 },
  { label: "1400-1600", lo: 1400, hi: 1600 },
  { label: "1600-1800", lo: 1600, hi: 1800 },
  { label: "≥1800", lo: 1800, hi: Infinity },
];

export interface HeatCell {
  topic: string;
  band: string;
  rate: number; // 0..100 solve rate
  attempts: number;
}

// Pattern (rows) × elo-band (cols): where in the difficulty curve each
// pattern breaks down.
export function patternHeatmap(data: EnrichedAttempt[]): {
  rows: string[];
  cells: HeatCell[];
} {
  const acc: Record<string, Record<string, { total: number; solved: number }>> = {};
  for (const d of data) {
    const band = ELO_BANDS.find((b) => d.elo >= b.lo && d.elo < b.hi);
    if (!band) continue;
    for (const t of d.topics) {
      const byBand = (acc[t] ??= {});
      const cell = (byBand[band.label] ??= { total: 0, solved: 0 });
      cell.total += 1;
      if (d.solved) cell.solved += 1;
    }
  }
  const candidates = Object.keys(acc).filter((t) => Object.values(acc[t]).some((c) => c.total >= 2));
  const rows = [
    ...CANONICAL_PATTERNS.filter((t) => candidates.includes(t)),
    ...candidates.filter((t) => !CANONICAL_PATTERNS.includes(t)),
  ];
  const cells: HeatCell[] = [];
  for (const topic of rows) {
    for (const b of ELO_BANDS) {
      const c = acc[topic]?.[b.label];
      if (c && c.total > 0) {
        cells.push({ topic, band: b.label, rate: Math.round((c.solved / c.total) * 100), attempts: c.total });
      }
    }
  }
  return { rows, cells };
}

export const FAILURE_MODES: { key: FailureMode | "gave_up" | "abandoned"; label: string; color: string }[] = [
  { key: "wrong-answer", label: "Wrong answer", color: "#e0564b" },
  { key: "tle", label: "TLE", color: "#e0a93b" },
  { key: "runtime-error", label: "Runtime error", color: "#9b6bd6" },
  { key: "compile-error", label: "Compile error", color: "#4a90d0" },
  { key: "gave_up", label: "Gave up", color: "#6b7280" },
  { key: "abandoned", label: "Abandoned", color: "#8a8f99" },
];

export interface FailureBucket {
  label: string;
  "wrong-answer": number;
  tle: number;
  "runtime-error": number;
  "compile-error": number;
  gave_up: number;
  abandoned: number;
}

// Stacked failure-mode counts over time. Buckets by day when there's more than
// one active day, otherwise by attempt.
export function failureOverTime(data: EnrichedAttempt[]): FailureBucket[] {
  const days = new Set(data.map((d) => dayKey(d.at)));
  const byDay = days.size > 1;
  const buckets = new Map<string, FailureBucket>();
  const ensure = (label: string) =>
    buckets.get(label) ?? {
      label,
      "wrong-answer": 0,
      tle: 0,
      "runtime-error": 0,
      "compile-error": 0,
      gave_up: 0,
      abandoned: 0,
    };
  for (const d of data) {
    if (d.solved) continue;
    const key = byDay ? dayKey(d.at) : `${d.attemptIndex + 1}`;
    const label = byDay ? key : `Attempt ${d.attemptIndex + 1}`;
    const b = ensure(label);
    if (d.failureMode) b[d.failureMode] += 1;
    else if (d.result === "gave_up") b.gave_up += 1;
    else if (d.result === "abandoned") b.abandoned += 1;
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export interface TimeBucket {
  label: string;
  read: number;
  write: number;
  debug: number;
}

// Stacked read/write/debug time per week (day when only one week of data).
export function timePhases(data: EnrichedAttempt[]): TimeBucket[] {
  const days = new Set(data.map((d) => dayKey(d.at)));
  const byDay = days.size > 1;
  const buckets = new Map<string, { read: number; write: number; debug: number; n: number }>();
  for (const d of data) {
    const key = byDay ? dayKey(d.at) : `${d.attemptIndex + 1}`;
    const b = buckets.get(key) ?? { read: 0, write: 0, debug: 0, n: 0 };
    b.read += d.readTime;
    b.write += d.writeTime;
    b.debug += d.debugTime;
    b.n += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, b]) => ({
      label: byDay ? label : `Attempt ${label}`,
      read: Math.round(b.read / b.n),
      write: Math.round(b.write / b.n),
      debug: Math.round(b.debug / b.n),
    }));
}

export interface ScatterPoint {
  hints: 0 | 1;
  elo: number;
  ai: boolean;
  title: string;
  solved: boolean;
}

// hints-used (x) vs elo (y), colored by AI-used (split into two series).
export function hintsVsElo(data: EnrichedAttempt[]): {
  withAi: ScatterPoint[];
  withoutAi: ScatterPoint[];
} {
  const withAi: ScatterPoint[] = [];
  const withoutAi: ScatterPoint[] = [];
  for (const d of data) {
    const pt: ScatterPoint = { hints: d.hints ? 1 : 0, elo: d.elo, ai: d.ai, title: d.title, solved: d.solved };
    (d.ai ? withAi : withoutAi).push(pt);
  }
  return { withAi, withoutAi };
}

export interface RetryRow {
  slug: string;
  title: string;
  attempts: number;
  firstResult: AttemptResult;
  lastResult: AttemptResult;
  elo: number;
  timeDelta: number; // last - first (seconds)
  hintsDelta: number; // last - first (used? 1:0)
  improved: boolean;
  verdict: string;
}

// Nodes attempted 2+ times, with deltas between first and last attempt.
export function retryTable(data: EnrichedAttempt[]): RetryRow[] {
  const bySlug: Record<string, EnrichedAttempt[]> = {};
  for (const d of data) (bySlug[d.slug] ??= []).push(d);
  const rows: RetryRow[] = [];
  for (const [slug, list] of Object.entries(bySlug)) {
    if (list.length < 2) continue;
    const first = list[0];
    const last = list[list.length - 1];
    const timeDelta = last.totalTime - first.totalTime;
    const hintsDelta = (last.hints ? 1 : 0) - (first.hints ? 1 : 0);
    const improved = !first.solved && last.solved;
    const verdict = improved
      ? "Learned"
      : last.solved && first.solved
        ? "Re-confirmed"
        : timeDelta < -30
          ? "Faster, not solved"
          : "No progress";
    rows.push({
      slug,
      title: last.title,
      attempts: list.length,
      firstResult: first.result,
      lastResult: last.result,
      elo: last.elo,
      timeDelta,
      hintsDelta,
      improved,
      verdict,
    });
  }
  return rows.sort((a, b) => a.elo - b.elo);
}

export interface Summary {
  total: number;
  solved: number;
  solveRate: number;
  firstTryRate: number;
  eventuallyCorrectRate: number;
  avgElo: number;
  avgHints: number;
  avgDebug: number;
  nodes: number;
  retryNodes: number;
}

export function summarize(data: EnrichedAttempt[]): Summary {
  const total = data.length;
  const solved = data.filter((d) => d.solved).length;
  const nodes = new Set(data.map((d) => d.slug)).size;
  const retryNodes = Object.values(
    data.reduce<Record<string, number>>((m, d) => {
      m[d.slug] = (m[d.slug] ?? 0) + 1;
      return m;
    }, {})
  ).filter((c) => c >= 2).length;
  const firstTry = data.filter((d) => d.firstTry).length;
  const eventually = data.filter((d) => d.eventuallyCorrect && d.solved).length;
  const avgElo = total ? Math.round(data.reduce((s, d) => s + d.elo, 0) / total) : 0;
  const avgHints = total ? data.filter((d) => d.hints).length / total : 0;
  const avgDebug = total ? Math.round(data.reduce((s, d) => s + d.debugTime, 0) / total) : 0;
  return {
    total,
    solved,
    solveRate: total ? Math.round((solved / total) * 100) : 0,
    firstTryRate: total ? Math.round((firstTry / total) * 100) : 0,
    eventuallyCorrectRate: total ? Math.round((eventually / total) * 100) : 0,
    avgElo,
    avgHints: Math.round(avgHints * 100) / 100,
    avgDebug,
    nodes,
    retryNodes,
  };
}

export const FAILURE_COLOR: Record<string, string> = Object.fromEntries(
  FAILURE_MODES.map((m) => [m.key, m.color])
);
