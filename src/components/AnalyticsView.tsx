import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FaChartLine,
  FaBullseye,
  FaFire,
  FaBolt,
  FaLightbulb,
  FaRegClock,
  FaRotate,
} from "react-icons/fa6";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  getEnrichedAttempts,
  summarize,
  eloOverTime,
  patternRadar,
  patternHeatmap,
  failureOverTime,
  timePhases,
  hintsVsElo,
  retryTable,
  ELO_BANDS,
  FAILURE_MODES,
  type EnrichedAttempt,
} from "../state/analytics";
import type { MapMeta } from "../state/library";
import "../analytics.css";

function fmtTime(s: number): string {
  const sign = s < 0 ? "-" : "";
  const a = Math.abs(s);
  const m = Math.floor(a / 60);
  const sec = a % 60;
  return m > 0 ? `${sign}${m}m${sec ? sec + "s" : ""}` : `${sign}${sec}s`;
}

function Empty() {
  return (
    <div className="analytics-empty">
      No attempts logged yet. Solve a node on the map and submit a report — your
      analytics will appear here.
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <motion.div whileHover={{ y: -4, rotate: -1 }} className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </motion.div>
  );
}

// Brutalist, on-palette heat scale: red (0%) -> yellow (50%) -> green (100%).
// Hard stops, no soft gradient.
function heatColor(rate: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [255, 107, 107]], // accent red
    [50, [255, 217, 61]], // secondary yellow
    [100, [74, 222, 128]], // ok green
  ];
  const t = Math.max(0, Math.min(100, rate));
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const k = (t - a[0]) / span;
  const ch = (i: number) => Math.round(a[1][i] + (b[1][i] - a[1][i]) * k);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

// Brutalist series palette used across the charts.
const C = {
  accent: "#FF6B6B",
  secondary: "#FFD93D",
  muted: "#C4B5FD",
  ink: "#000000",
  ok: "#4ADE80",
  lightRed: "#FFB3B3",
  lightViolet: "#E5DEFF",
};
const FAILURE_FILL: Record<string, string> = {
  "wrong-answer": C.accent,
  tle: C.secondary,
  "runtime-error": C.muted,
  "compile-error": C.ink,
  gave_up: C.lightRed,
  abandoned: C.lightViolet,
};
const AXIS = { fill: "#000", fontSize: 12, fontWeight: 700 } as const;
const LEGEND = { fontWeight: 900, fontSize: 12, color: "#000", textTransform: "uppercase" } as const;

function Heatmap({ data }: { data: EnrichedAttempt[] }) {
  const { rows, cells } = useMemo(() => patternHeatmap(data), [data]);
  if (rows.length === 0) return <Empty />;
  const cellW = 96;
  const cellH = 30;
  const labelW = 150;
  const cellMap = new Map(cells.map((c) => [`${c.topic}|${c.band}`, c]));
  return (
    <div className="heatmap-scroll">
      <svg width={labelW + ELO_BANDS.length * cellW + 10} height={rows.length * cellH + 28}>
        {ELO_BANDS.map((b, i) => (
          <text key={b.label} x={labelW + i * cellW + cellW / 2} y={16} className="hm-col">
            {b.label}
          </text>
        ))}
        {rows.map((topic, r) => (
          <g key={topic}>
            <text x={labelW - 6} y={r * cellH + 28 + cellH / 2} className="hm-row">
              {topic}
            </text>
            {ELO_BANDS.map((b, i) => {
              const c = cellMap.get(`${topic}|${b.label}`);
              return (
                <rect
                  key={b.label}
                  x={labelW + i * cellW}
                  y={r * cellH + 28}
                  width={cellW - 2}
                  height={cellH - 2}
                  fill={c ? heatColor(c.rate) : "#FFFDF5"}
                  stroke="#000"
                  strokeWidth={2}
                >
                  <title>
                    {c
                      ? `${topic} @ ${b.label}: ${c.rate}% solved (${c.attempts} attempts)`
                      : `${topic} @ ${b.label}: no attempts`}
                  </title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AnalyticsView({ map }: { map: MapMeta }) {
  const data = useMemo(
    () => getEnrichedAttempts(new Set(map.nodes.map((n) => n.slug)), map.problems),
    [map]
  );
  const summary = useMemo(() => summarize(data), [data]);
  const elo = useMemo(() => eloOverTime(data), [data]);
  const radar = useMemo(() => patternRadar(data), [data]);
  const failures = useMemo(() => failureOverTime(data), [data]);
  const phases = useMemo(() => timePhases(data), [data]);
  const scatter = useMemo(() => hintsVsElo(data), [data]);
  const retries = useMemo(() => retryTable(data), [data]);

  return (
    <div className="analytics">
      <div className="stat-row">
        <Stat value={summary.total} label="Attempts" />
        <Stat value={`${summary.solveRate}%`} label="Solve rate" />
        <Stat value={`${summary.firstTryRate}%`} label="First-try correct" />
        <Stat value={`${summary.eventuallyCorrectRate}%`} label="Eventually correct" />
        <Stat value={summary.avgElo} label="Avg elo" />
        <Stat value={summary.avgHints} label="Avg hints/attempt" />
        <Stat value={fmtTime(summary.avgDebug)} label="Avg debug time" />
        <Stat value={summary.retryNodes} label="Re-attempted nodes" />
      </div>

      <div className="dash-grid">
        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-2">
          <h3><FaChartLine className="mr-1 inline text-neo-accent" />1 · Elo over time</h3>
          <p className="dash-sub">Solved attempts' elo with a 5-attempt rolling average. The headline "am I getting better" line.</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={elo} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.18)" />
              <XAxis dataKey="i" tick={AXIS} />
              <YAxis
                tick={AXIS}
                domain={elo.length ? (["dataMin - 100", "dataMax + 100"] as [string, string]) : ([900, 2500] as [number, number])}
              />
              <Tooltip contentStyle={tipStyle} labelFormatter={(l) => `Attempt #${l}`} formatter={(v, n) => [v, n === "elo" ? "elo" : "trend"]} />
              <Legend wrapperStyle={LEGEND} />
              <Line type="monotone" dataKey="elo" stroke={C.accent} strokeWidth={3} dot={{ r: 3, fill: C.accent, stroke: "#000", strokeWidth: 2 }} name="elo" />
              <Line type="monotone" dataKey="trend" stroke="#000" dot={false} strokeWidth={3} strokeDasharray="6 4" name="trend" />
            </LineChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash">
          <h3><FaBullseye className="mr-1 inline text-neo-muted" />2 · Pattern radar</h3>
          <p className="dash-sub">Solve rate per pattern/tag. Shows your weak spike vs strong spike at a glance.</p>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radar} outerRadius="72%">
              <PolarGrid stroke="#000" strokeOpacity={0.3} />
              <PolarAngleAxis dataKey="topic" tick={{ fill: "#000", fontSize: 11, fontWeight: 700 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#000", fontSize: 10, fontWeight: 700 }} />
              <Radar name="solve rate" dataKey="solveRate" stroke="#000" strokeWidth={3} fill={C.accent} fillOpacity={0.5} />
              <Tooltip contentStyle={tipStyle} formatter={(v, n) => [`${v}%`, n]} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-2">
          <h3><FaFire className="mr-1 inline text-neo-orange" />3 · Pattern × elo-band heatmap</h3>
          <p className="dash-sub">Solve rate where each pattern breaks down across the difficulty curve. Only patterns with ≥2 attempts shown.</p>
          <Heatmap data={data} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-2">
          <h3><FaBolt className="mr-1 inline text-neo-accent" />4 · Failure mode over time</h3>
          <p className="dash-sub">Watch the TLE slice shrink vs wrong-answer as you move from "doesn't get it" to "gets it, needs to optimize".</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={failures} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.18)" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(0,0,0,0.06)" }} />
              <Legend wrapperStyle={LEGEND} />
              {FAILURE_MODES.map((m) => (
                <Bar key={m.key} dataKey={m.key} stackId="f" fill={FAILURE_FILL[m.key]} stroke="#000" strokeWidth={2} name={m.label} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash">
          <h3><FaLightbulb className="mr-1 inline text-neo-pink" />5 · Hints vs elo</h3>
          <p className="dash-sub">Colored by AI use. Flat hints/AI as elo rises = solving harder but not more independently.</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.18)" />
              <XAxis type="number" dataKey="hints" name="hints" ticks={[0, 1]} tickFormatter={(v) => (v ? "hint" : "none")} tick={AXIS} />
              <YAxis type="number" dataKey="elo" name="elo" tick={AXIS} />
              <ZAxis range={[60, 60]} />
              <Tooltip contentStyle={tipStyle} cursor={{ strokeDasharray: "3 3", stroke: "#000" }} formatter={(v, n) => [v, n]} />
              <Legend wrapperStyle={LEGEND} />
              <Scatter name="with AI" data={scatter.withAi} fill={C.accent} stroke="#000" strokeWidth={2} />
              <Scatter name="no AI" data={scatter.withoutAi} fill="#000" stroke="#000" strokeWidth={2} />
            </ScatterChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-2">
          <h3><FaRegClock className="mr-1 inline text-neo-blue" />6 · Time phases</h3>
          <p className="dash-sub">Read/think vs write vs debug per bucket. Shrinking debug time is your most honest skill signal.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={phases} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.18)" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} />
              <Tooltip contentStyle={tipStyle} formatter={(v, n) => [`${fmtTime(Number(v))}`, n]} cursor={{ fill: "rgba(0,0,0,0.06)" }} />
              <Legend wrapperStyle={LEGEND} />
              <Bar dataKey="read" stackId="t" fill={C.secondary} stroke="#000" strokeWidth={2} name="read/think" />
              <Bar dataKey="write" stackId="t" fill={C.accent} stroke="#000" strokeWidth={2} name="write" />
              <Bar dataKey="debug" stackId="t" fill={C.muted} stroke="#000" strokeWidth={2} name="debug" />
            </BarChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaRotate className="mr-1 inline text-neo-ok" />7 · Retry improvement</h3>
          <p className="dash-sub">Nodes attempted 2+ times. Stop re-grinding rows that show zero delta — they're not teaching you anything.</p>
          {retries.length === 0 ? (
            <p className="dash-sub">No node has been attempted more than once yet.</p>
          ) : (
            <div className="retry-table-wrap">
              <table className="retry-table">
                <thead>
                  <tr>
                    <th>Problem</th>
                    <th>elo</th>
                    <th>Attempts</th>
                    <th>First</th>
                    <th>Last</th>
                    <th>Time Δ</th>
                    <th>Hints Δ</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {retries.map((r) => (
                    <tr key={r.slug} className={r.improved ? "ok" : r.verdict === "No progress" ? "bad" : ""}>
                      <td>{r.title}</td>
                      <td>{r.elo}</td>
                      <td>{r.attempts}</td>
                      <td><span className={`r-tag ${r.firstResult}`}>{r.firstResult}</span></td>
                      <td><span className={`r-tag ${r.lastResult}`}>{r.lastResult}</span></td>
                      <td>{fmtTime(r.timeDelta)}</td>
                      <td>{r.hintsDelta > 0 ? "+" : ""}{r.hintsDelta}</td>
                      <td>{r.verdict}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

const tipStyle = {
  background: "#FFFDF5",
  border: "4px solid #000",
  borderRadius: 0,
  boxShadow: "4px 4px 0 0 #000",
  color: "#000",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase" as const,
};
