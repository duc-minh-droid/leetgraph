import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FaFire,
  FaMap,
  FaArrowRight,
  FaBolt,
  FaLayerGroup,
  FaRankingStar,
  FaKhanda,
  FaScroll,
  FaCheck,
  FaCrown,
  FaLock,
} from "react-icons/fa6";
import { listMaps } from "./state/library";
import { currentLevel } from "./state/xp";
import { currentRating, START_RATING } from "./state/rating";
import { equippedTitle } from "./state/achievements";
import { currentStreak, getEnrichedAttempts } from "./state/analytics";
import { todaysQuest } from "./state/quests";
import { dueReviews } from "./state/reviews";
import { equippedSkin } from "./state/coachSkins";
import { CoachPreview } from "./components/Coach";

const CARD_COLORS = [
  "bg-neo-accent",
  "bg-neo-secondary",
  "bg-neo-muted",
  "bg-neo-pink",
];

// Player card shown once there's any history — your run so far, at a glance.
function PlayerCard() {
  const rating = useMemo(() => currentRating(), []);
  const title = useMemo(() => equippedTitle(), []);
  const streak = useMemo(() => currentStreak(), []);
  const quest = useMemo(() => todaysQuest(), []);
  const due = useMemo(() => dueReviews().length, []);
  const skin = useMemo(() => equippedSkin(), []);

  return (
    <motion.div
      initial={{ x: 30, opacity: 0, rotate: 3 }}
      animate={{ x: 0, opacity: 1, rotate: 1 }}
      whileHover={{ rotate: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="hidden w-[270px] shrink-0 border-4 border-black bg-white shadow-neo lg:block"
    >
      <div className="flex items-center justify-between border-b-4 border-black bg-neo-secondary px-3 py-1.5">
        <span className="text-xs font-black uppercase tracking-widest">Your run</span>
        <FaCrown className="text-neo-accent" />
      </div>
      <div className="flex items-center gap-3 p-3">
        <motion.div
          animate={{ y: [0, -3, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="shrink-0 border-4 border-black bg-neo-bg shadow-neo-sm"
        >
          <CoachPreview skinId={skin.id} size={72} />
        </motion.div>
        <div className="min-w-0">
          <div className="flex items-stretch border-2 border-black bg-black">
            <span className="flex items-center gap-1 bg-neo-secondary px-1.5 text-[9px] font-black uppercase">
              <FaRankingStar /> Elo
            </span>
            <span className="px-2 py-0.5 text-sm font-black tabular-nums text-white">{rating}</span>
          </div>
          <div className="mt-1 truncate text-[10px] font-black uppercase text-black/60">"{title}"</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-black uppercase">
            <span className="flex items-center gap-1">
              <FaFire className="text-neo-orange" /> {streak}d
            </span>
            {due > 0 && (
              <span className="flex items-center gap-1 text-neo-accent">
                <FaKhanda /> {due} due
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        className={`flex items-center gap-1.5 border-t-2 border-black px-3 py-1.5 text-[10px] font-black uppercase ${
          quest.done ? "bg-neo-ok" : "bg-neo-bg"
        }`}
      >
        {quest.done ? <FaCheck /> : <FaScroll className="text-neo-muted" />}
        <span className="truncate">{quest.done ? "Quest complete!" : quest.label}</span>
      </div>
    </motion.div>
  );
}

export function Home() {
  const maps = listMaps();
  const totalProblems = maps.reduce((s, m) => s + m.nodeCount, 0);
  const totalActs = Math.max(...maps.map((m) => m.acts));
  const hasHistory = useMemo(() => getEnrichedAttempts().length > 0, []);
  const level = useMemo(() => currentLevel(), []);

  return (
    <div className="min-h-full overflow-y-auto bg-neo-bg bg-grid font-display text-neo-ink">
      <div className="mx-auto max-w-6xl px-5 py-10 md:py-16">
        {/* Hero */}
        <motion.header
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between"
        >
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <motion.img
                src="/logo.svg"
                alt="LeetGraph logo"
                initial={{ rotate: -8, scale: 0 }}
                animate={{ rotate: -4, scale: 1 }}
                whileHover={{ rotate: 4, scale: 1.08 }}
                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                className="h-14 w-14 md:h-[72px] md:w-[72px]"
              />
              <motion.div
                whileHover={{ rotate: 0, scale: 1.03 }}
                className="inline-block rotate-[-2deg] border-4 border-black bg-neo-accent px-4 py-2 shadow-neo"
              >
                <span className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">LEET</span>
                <span className="text-3xl font-black uppercase tracking-tight md:text-5xl">GRAPH</span>
              </motion.div>
              <motion.span
                initial={{ scale: 0, rotate: 20 }}
                animate={{ scale: 1, rotate: 8 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 320, damping: 14 }}
                whileHover={{ rotate: -4 }}
                className="hidden border-4 border-black bg-neo-secondary px-2 py-1 text-[11px] font-black uppercase shadow-neo-sm sm:inline-block"
              >
                Slay-the-Spire style
              </motion.span>
            </div>
            <h1 className="max-w-2xl text-2xl font-black uppercase leading-tight tracking-tight md:text-4xl">
              Grind LeetCode like a{" "}
              <span className="bg-neo-secondary px-1 shadow-neo-sm">roguelike</span>.
              <br />
              Pick a roadmap, climb the acts.
            </h1>
            <p className="mt-3 max-w-xl text-sm font-bold uppercase tracking-wide text-black/70">
              Real company problem exports — parsed, tiered by Elo, laid out across {totalActs} acts.
              Voice-interview bosses included.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: <FaLayerGroup key="i" />, label: `${maps.length} roadmaps`, cls: "bg-neo-secondary" },
                { icon: <FaBolt key="i" />, label: `${totalProblems} problems`, cls: "bg-neo-muted" },
                { icon: <FaRankingStar key="i" />, label: `Elo from ${START_RATING}`, cls: "bg-neo-pink text-white" },
              ].map((c, i) => (
                <motion.span
                  key={c.label}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
                  whileHover={{ y: -3, rotate: i % 2 ? 2 : -2 }}
                  className={`flex items-center gap-1.5 border-4 border-black px-3 py-1 text-xs font-black uppercase shadow-neo-sm ${c.cls}`}
                >
                  {c.icon} {c.label}
                </motion.span>
              ))}
            </div>
          </div>

          {hasHistory && <PlayerCard />}
        </motion.header>

        {/* Map selection */}
        <section className="mt-12">
          <div className="mb-5 flex items-center gap-2">
            <FaMap className="text-2xl text-neo-accent" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Choose your roadmap</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {maps.map((m, i) => {
              const locked = level < m.requiredLevel;
              return (
              <motion.div
                key={m.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 22 }}
                whileHover={locked ? {} : { y: -8, rotate: i % 2 === 0 ? -1 : 1, boxShadow: "12px 12px 0px 0px #000" }}
                className={`group relative flex flex-col border-4 border-black bg-white shadow-neo ${locked ? "grayscale" : ""}`}
              >
                {locked && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-black/55">
                    <div className="flex rotate-[-3deg] flex-col items-center gap-1 border-4 border-black bg-neo-secondary px-4 py-2 shadow-neo">
                      <FaLock className="text-xl" />
                      <span className="text-sm font-black uppercase">Level {m.requiredLevel}</span>
                      <span className="text-[9px] font-bold uppercase text-black/70">
                        You're level {level} — keep grinding
                      </span>
                    </div>
                  </div>
                )}
                {m.progress >= 100 && (
                  <span className="absolute -right-2 -top-3 z-10 rotate-6 border-2 border-black bg-neo-ok px-2 py-0.5 text-[10px] font-black uppercase shadow-neo-sm">
                    Mastered
                  </span>
                )}
                <div className={`flex items-center justify-between px-3 py-1 ${CARD_COLORS[i % CARD_COLORS.length]}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {m.acts} acts
                  </span>
                  <FaKhanda className="text-[11px] opacity-70 transition-transform duration-200 group-hover:rotate-12" />
                </div>
                <div className="flex flex-1 flex-col gap-3 border-t-4 border-black p-4">
                  <h3 className="text-xl font-black uppercase leading-none tracking-tight">{m.name}</h3>
                  <p className="flex-1 text-xs font-bold uppercase leading-snug text-black/70">{m.description}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase">
                    <span className="border-2 border-black bg-neo-bg px-2 py-0.5 transition-colors group-hover:bg-neo-secondary">
                      {m.nodeCount} nodes
                    </span>
                    <span className="inline-flex items-stretch border-2 border-black bg-black">
                      <span className="grid place-items-center bg-neo-secondary px-1">
                        <FaBolt className="text-[8px]" />
                      </span>
                      <span className="px-1.5 py-0.5 tabular-nums text-white">
                        {m.eloMin}–{m.eloMax}
                      </span>
                    </span>
                  </div>
                  {m.progress > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 border-2 border-black bg-neo-bg">
                        <motion.div
                          className="h-full bg-neo-ok"
                          initial={{ width: 0 }}
                          animate={{ width: `${m.progress}%` }}
                          transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 100, damping: 20 }}
                        />
                      </div>
                      <span className="text-[11px] font-black tabular-nums">{m.progress}%</span>
                    </div>
                  )}
                  <Link
                    to={`/map/${m.id}`}
                    className="mt-1 flex items-center justify-center gap-2 border-4 border-black bg-neo-accent px-4 py-2 text-sm font-black uppercase shadow-neo-sm transition-all duration-100 ease-linear hover:bg-neo-secondary active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                  >
                    {m.progress > 0 ? "Continue" : "Start"}{" "}
                    <FaArrowRight className="transition-transform duration-150 group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
              );
            })}
          </div>
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-2 border-t-4 border-black pt-5 text-xs font-bold uppercase tracking-wide text-black/60">
          <span>LEETGRAPH — study roadmaps, not just problems.</span>
          <span className="flex items-center gap-1">
            Built like a boss fight <FaKhanda className="text-neo-accent" />
          </span>
        </footer>
      </div>
    </div>
  );
}
