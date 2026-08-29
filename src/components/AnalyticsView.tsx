import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FaChartLine,
  FaBullseye,
  FaFire,
  FaBolt,
  FaLightbulb,
  FaRegClock,
  FaRotate,
  FaMap,
  FaTrophy,
  FaLock,
  FaCalendarDays,
  FaCrown,
  FaUserGroup,
} from "react-icons/fa6";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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
  patternRadar,
  patternHeatmap,
  failureOverTime,
  timePhases,
  hintsVsElo,
  retryTable,
  currentStreak,
  ELO_BANDS,
  FAILURE_MODES,
  type EnrichedAttempt,
} from "../state/analytics";
import { ratingHistory, currentRating, START_RATING } from "../state/rating";
import {
  ACHIEVEMENTS,
  unlockedAchievements,
  equippedTitle,
  equipTitle,
} from "../state/achievements";
import {
  COACH_SKINS,
  isSkinUnlocked,
  equippedSkin,
  equipSkin,
  achievementName,
} from "../state/coachSkins";
import { emitCoach } from "../state/coachBus";
import { CoachPreview } from "./Coach";
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
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="analytics-empty"
    >
      <FaMap className="analytics-empty-icon" />
      <strong>No data yet</strong>
      No attempts logged. Head to the map, crack an available node, and submit a
      report — every chart here lights up from your very first attempt.
    </motion.div>
  );
}

function Stat({ value, label, delay = 0 }: { value: string | number; label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 320, damping: 22 }}
      whileHover={{ y: -4, rotate: -1 }}
      className="stat"
    >
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
const AXIS_LINE = { stroke: "#000", strokeWidth: 2 } as const;
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
                <g key={b.label}>
                  <rect
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
                  {c && (
                    <text
                      x={labelW + i * cellW + (cellW - 2) / 2}
                      y={r * cellH + 28 + (cellH - 2) / 2}
                      className="hm-cell"
                      pointerEvents="none"
                    >
                      {c.rate}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

// GitHub-style contribution calendar (attempts per day, last ~20 weeks).
function Calendar({ data }: { data: EnrichedAttempt[] }) {
  const WEEKS = 20;
  const { grid, monthLabels } = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of data) {
      const d = new Date(a.at);
      d.setHours(0, 0, 0, 0);
      counts.set(d.getTime(), (counts.get(d.getTime()) ?? 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today.getTime() - (WEEKS * 7 - 1) * 86400000);
    start.setDate(start.getDate() - start.getDay()); // align to Sunday
    const grid: { t: number; count: number; future: boolean }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; ; w++) {
      const col: { t: number; count: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const t = start.getTime() + (w * 7 + d) * 86400000;
        col.push({ t, count: counts.get(t) ?? 0, future: t > today.getTime() });
      }
      const m = new Date(col[0].t).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: w, label: new Date(col[0].t).toLocaleString("en", { month: "short" }) });
        lastMonth = m;
      }
      grid.push(col);
      if (col[6].t >= today.getTime()) break;
    }
    return { grid, monthLabels };
  }, [data]);

  const color = (c: number) => (c === 0 ? "#FFFDF5" : c === 1 ? "#FFD93D" : c <= 3 ? "#FF9F45" : "#FF6B6B");
  const CELL = 16;
  return (
    <div className="overflow-x-auto">
      <svg width={grid.length * CELL + 8} height={7 * CELL + 20}>
        {monthLabels.map((m) => (
          <text key={m.col} x={m.col * CELL + 2} y={12} className="hm-col" textAnchor="start">
            {m.label}
          </text>
        ))}
        {grid.map((col, w) =>
          col.map((cell, d) =>
            cell.future ? null : (
              <rect
                key={`${w}-${d}`}
                x={w * CELL + 2}
                y={d * CELL + 18}
                width={CELL - 3}
                height={CELL - 3}
                fill={color(cell.count)}
                stroke="#000"
                strokeWidth={1.5}
              >
                <title>{`${new Date(cell.t).toDateString()}: ${cell.count} attempt${cell.count === 1 ? "" : "s"}`}</title>
              </rect>
            )
          )
        )}
      </svg>
    </div>
  );
}

// Achievements grid + equippable titles.
function Achievements({ rev, onChanged }: { rev: number; onChanged?: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => equippedTitle(), [rev]);
  return (
    <div className="ach-grid">
      {ACHIEVEMENTS.map((a) => {
        const isUnlocked = unlocked.has(a.id);
        const isEquipped = a.title === equipped;
        return (
          <motion.div
            key={a.id}
            whileHover={isUnlocked ? { y: -3, rotate: -1 } : {}}
            className={`ach-card ${isUnlocked ? "" : "locked"}`}
          >
            <div className="flex items-center gap-2">
              {isUnlocked ? <FaTrophy className="text-neo-orange" /> : <FaLock className="opacity-40" />}
              <strong>{a.name}</strong>
            </div>
            <p>{a.desc}</p>
            {a.title && (
              <motion.button
                whileHover={isUnlocked ? { scale: 1.08, rotate: -2 } : {}}
                whileTap={isUnlocked ? { scale: 0.9 } : {}}
                disabled={!isUnlocked}
                onClick={() => {
                  equipTitle(a.title!);
                  onChanged?.();
                }}
                className={`ach-title ${isEquipped ? "equipped" : ""}`}
                title={isUnlocked ? "Equip this title" : "Unlock to equip"}
              >
                {isEquipped && <FaCrown className="mr-1 inline text-[10px]" />}
                {a.title}
              </motion.button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// Coach skin locker — skins are achievement rewards.
function CoachLocker({ rev, onChanged }: { rev: number; onChanged?: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => {
    void rev;
    return equippedSkin().id;
  }, [rev]);
  return (
    <div className="coach-grid">
      {COACH_SKINS.map((skin) => {
        const open = isSkinUnlocked(skin, unlocked);
        const isEquipped = skin.id === equipped;
        return (
          <motion.button
            key={skin.id}
            whileHover={open ? { y: -4, rotate: -1 } : {}}
            whileTap={open ? { scale: 0.93 } : {}}
            disabled={!open}
            onClick={() => {
              equipSkin(skin.id);
              emitCoach({ type: "skin-equipped", name: skin.name });
              onChanged?.();
            }}
            className={`coach-card ${open ? "" : "locked"} ${isEquipped ? "equipped" : ""}`}
            title={
              open
                ? isEquipped
                  ? `${skin.name} is your coach`
                  : `Equip ${skin.name}`
                : `Unlock via "${achievementName(skin.achievement!)}"`
            }
          >
            <div className={open ? "" : "grayscale opacity-50"}>
              <CoachPreview skinId={skin.id} size={64} />
            </div>
            <strong>{skin.name}</strong>
            <span className="coach-req">
              {!open ? (
                <>
                  <FaLock className="inline text-[9px]" /> {achievementName(skin.achievement!)}
                </>
              ) : isEquipped ? (
                <>
                  <FaCrown className="inline text-[9px]" /> Equipped
                </>
              ) : skin.achievement ? (
                achievementName(skin.achievement)
              ) : (
                "Starter"
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function AnalyticsView({ map, onChanged }: { map: MapMeta; onChanged?: () => void }) {
  const data = useMemo(
    () => getEnrichedAttempts(new Set(map.nodes.map((n) => n.slug)), map.problems),
    [map]
  );
  const summary = useMemo(() => summarize(data), [data]);
  // Player rating is global (all maps) so the header number and this chart agree.
  const rating = useMemo(() => {
    void data;
    return ratingHistory();
  }, [data]);
  const playerRating = useMemo(() => {
    void data;
    return currentRating();
  }, [data]);
  const radar = useMemo(() => patternRadar(data), [data]);
  const failures = useMemo(() => failureOverTime(data), [data]);
  const phases = useMemo(() => timePhases(data), [data]);
  const scatter = useMemo(() => hintsVsElo(data), [data]);
  const retries = useMemo(() => retryTable(data), [data]);
  const streak = useMemo(() => currentStreak(), [data]);
  const [achRev, setAchRev] = useState(0);

  if (data.length === 0) {
    return (
      <div className="analytics">
        <Empty />
      </div>
    );
  }

  return (
    <div className="analytics">
      <div className="stat-row">
        <Stat value={playerRating} label="Player rating" delay={0} />
        <Stat value={streak} label="Day streak" delay={0.03} />
        <Stat value={summary.total} label="Attempts" delay={0.06} />
        <Stat value={`${summary.solveRate}%`} label="Solve rate" delay={0.09} />
        <Stat value={`${summary.firstTryRate}%`} label="First-try correct" delay={0.12} />
        <Stat value={summary.avgHints} label="Avg hints/attempt" delay={0.15} />
        <Stat value={fmtTime(summary.avgDebug)} label="Avg debug time" delay={0.18} />
        <Stat value={summary.retryNodes} label="Re-attempted nodes" delay={0.21} />
      </div>

      <div className="dash-grid">
        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-2">
          <h3><FaChartLine className="mr-1 inline text-neo-accent" />1 · Player rating</h3>
          <p className="dash-sub">Your chess-style rating across all maps — every attempt moves it. Violet dots are the problems' elo.</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rating} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.12)" vertical={false} />
              <XAxis dataKey="i" tick={AXIS} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis
                tick={AXIS}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={44}
                domain={
                  rating.length
                    ? (["dataMin - 60", "dataMax + 60"] as [string, string])
                    : ([START_RATING - 200, START_RATING + 200] as [number, number])
                }
              />
              <Tooltip
                contentStyle={tipStyle}
                labelFormatter={(l) => `Attempt #${l}`}
                formatter={(v, n, item) => {
                  if (n === "rating") {
                    const d = (item?.payload as { delta?: number })?.delta ?? 0;
                    return [`${v} (${d > 0 ? "+" : ""}${d})`, "rating"];
                  }
                  return [v, "problem elo"];
                }}
              />
              <Legend wrapperStyle={LEGEND} iconType="plainline" />
              <Area type="monotone" dataKey="rating" stroke="none" fill="url(#ratingFill)" legendType="none" tooltipType="none" />
              <Line
                type="monotone"
                dataKey="probElo"
                stroke="none"
                dot={{ r: 2.5, fill: C.muted, stroke: "#000", strokeWidth: 1 }}
                name="problem elo"
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke={C.accent}
                strokeWidth={3}
                dot={{ r: 3.5, fill: C.accent, stroke: "#000", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: C.secondary, stroke: "#000", strokeWidth: 3 }}
                name="rating"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash">
          <h3><FaBullseye className="mr-1 inline text-neo-muted" />2 · Pattern radar</h3>
          <p className="dash-sub">Solve rate per pattern/tag. Shows your weak spike vs strong spike at a glance.</p>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radar} outerRadius="72%">
              <PolarGrid stroke="#000" strokeOpacity={0.22} />
              <PolarAngleAxis dataKey="topic" tick={{ fill: "#000", fontSize: 11, fontWeight: 700 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#000", fontSize: 10, fontWeight: 700 }} axisLine={false} tickCount={5} />
              <Radar name="solve rate" dataKey="solveRate" stroke="#000" strokeWidth={3} fill={C.accent} fillOpacity={0.45} dot={{ r: 3, fill: C.secondary, stroke: "#000", strokeWidth: 2 }} />
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
              <CartesianGrid stroke="rgba(0,0,0,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis tick={AXIS} allowDecimals={false} tickLine={false} axisLine={AXIS_LINE} width={36} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(0,0,0,0.06)" }} />
              <Legend wrapperStyle={LEGEND} iconType="square" />
              {FAILURE_MODES.map((m) => (
                <Bar key={m.key} dataKey={m.key} stackId="f" fill={FAILURE_FILL[m.key]} stroke="#000" strokeWidth={2} name={m.label} maxBarSize={48} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash">
          <h3><FaLightbulb className="mr-1 inline text-neo-pink" />5 · Hints vs elo</h3>
          <p className="dash-sub">Colored by AI use. Flat hints/AI as elo rises = solving harder but not more independently.</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.12)" />
              <XAxis type="number" dataKey="hints" name="hints" ticks={[0, 1]} tickFormatter={(v) => (v ? "hint" : "none")} tick={AXIS} tickLine={false} axisLine={AXIS_LINE} domain={[-0.5, 1.5]} />
              <YAxis type="number" dataKey="elo" name="elo" tick={AXIS} tickLine={false} axisLine={AXIS_LINE} width={44} />
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
              <CartesianGrid stroke="rgba(0,0,0,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis tick={AXIS} tickFormatter={(v) => fmtTime(Number(v))} tickLine={false} axisLine={AXIS_LINE} width={52} />
              <Tooltip contentStyle={tipStyle} formatter={(v, n) => [`${fmtTime(Number(v))}`, n]} cursor={{ fill: "rgba(0,0,0,0.06)" }} />
              <Legend wrapperStyle={LEGEND} iconType="square" />
              <Bar dataKey="read" stackId="t" fill={C.secondary} stroke="#000" strokeWidth={2} name="read/think" maxBarSize={48} />
              <Bar dataKey="write" stackId="t" fill={C.accent} stroke="#000" strokeWidth={2} name="write" maxBarSize={48} />
              <Bar dataKey="debug" stackId="t" fill={C.muted} stroke="#000" strokeWidth={2} name="debug" maxBarSize={48} />
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

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaCalendarDays className="mr-1 inline text-neo-blue" />8 · Activity</h3>
          <p className="dash-sub">Attempts per day on this map. Don't break the chain.</p>
          <Calendar data={data} />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaTrophy className="mr-1 inline text-neo-orange" />9 · Achievements</h3>
          <p className="dash-sub">Unlock achievements to earn titles — click an unlocked title to wear it in the header.</p>
          <Achievements
            rev={achRev}
            onChanged={() => {
              setAchRev((r) => r + 1);
              onChanged?.();
            }}
          />
        </motion.section>

        <motion.section whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card-dash span-3">
          <h3><FaUserGroup className="mr-1 inline text-neo-pink" />10 · Coach locker</h3>
          <p className="dash-sub">Coaches are achievement rewards — unlock them by playing, click one to make it yours.</p>
          <CoachLocker
            rev={achRev}
            onChanged={() => {
              setAchRev((r) => r + 1);
              onChanged?.();
            }}
          />
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
