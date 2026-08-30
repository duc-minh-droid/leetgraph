import { useState, useEffect, useMemo, useRef, lazy } from "react";
import { BoneSuspense } from "boneyard-js/react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useParams, useSearchParams, Navigate } from "react-router-dom";
import {
  FaMap,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaFire,
  FaUserTie,
  FaRankingStar,
  FaTrophy,
} from "react-icons/fa6";
import { GraphView } from "./components/GraphView";
import { AnalyticsView } from "./components/AnalyticsView";
import { AchievementsView } from "./components/AchievementsView";
import { Coach } from "./components/Coach";
import { getMap, listMaps, progressOf, currentActOf } from "./state/library";
import { currentRating } from "./state/rating";
import { equippedTitle } from "./state/achievements";
import { currentStreak } from "./state/analytics";

// Heavy tab (CodeMirror + Excalidraw + ElevenLabs SDK) — loaded on demand.
const InterviewView = lazy(() => import("./components/InterviewView"));

type Tab = "map" | "analytics" | "awards" | "interview";

const tap = { scale: 0.94 };
const hover = { scale: 1.04 };

// Rating (with animated ± delta) · streak.
function PlayerStrip({ rev }: { rev: number }) {
  const rating = useMemo(() => currentRating(), [rev]);
  const title = useMemo(() => equippedTitle(), [rev]);
  const streak = useMemo(() => currentStreak(), [rev]);

  const prevRef = useRef(rating);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const d = rating - prevRef.current;
    prevRef.current = rating;
    if (d !== 0) {
      setDelta(d);
      const t = setTimeout(() => setDelta(0), 2600);
      return () => clearTimeout(t);
    }
  }, [rating]);

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <motion.div
        whileHover={{ y: -2, rotate: -1 }}
        className="relative flex items-stretch border-4 border-black bg-black shadow-neo-sm"
        title={`Your Elo rating — playing as "${title}"`}
      >
        <span className="flex items-center gap-1 bg-neo-secondary px-1.5 text-[10px] font-black uppercase tracking-widest text-black">
          <FaRankingStar /> Elo
        </span>
        <motion.span
          key={rating}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          className="px-2 py-1 text-xs font-black tabular-nums text-white"
        >
          {rating}
        </motion.span>
        <AnimatePresence>
          {delta !== 0 && (
            <motion.span
              initial={{ y: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: -26, opacity: 1, scale: 1, rotate: delta > 0 ? -4 : 4 }}
              exit={{ opacity: 0, y: -38 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className={`absolute -right-2 -top-2 z-30 border-2 border-black px-1.5 py-0.5 text-xs font-black shadow-neo-sm ${
                delta > 0 ? "bg-neo-ok" : "bg-neo-accent text-white"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {streak > 0 && (
        <motion.span
          whileHover={{ y: -2, rotate: 2, scale: 1.06 }}
          title={`${streak}-day practice streak`}
          className="flex items-center gap-1 border-4 border-black bg-white px-2 py-1 text-xs font-black shadow-neo-sm"
        >
          <FaFire className="text-neo-orange" /> {streak}
        </motion.span>
      )}

    </div>
  );
}

export function MapApp() {
  const { mapId } = useParams();
  const valid = listMaps().some((m) => m.id === mapId);
  if (!valid) return <Navigate to="/" replace />;

  const map = getMap(mapId);
  // Tab is deep-linkable (?tab=interview) — also lets the boneyard capture
  // browser reach every tab for skeleton generation.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTabState] = useState<Tab>(
    urlTab === "analytics" || urlTab === "interview" || urlTab === "awards" ? urlTab : "map"
  );
  const setTab = (t: Tab) => {
    setTabState(t);
    setSearchParams(t === "map" ? {} : { tab: t }, { replace: true });
  };
  // Bumped after every submitted attempt so header progress/act stay live.
  const [rev, setRev] = useState(0);
  const act = currentActOf(map);
  const progress = progressOf(map);
  const totalActs = Math.max(...map.nodes.map((n) => n.act)) + 1;

  // Which act is being viewed on the map. Defaults to the latest unlocked act
  // and auto-advances when a new act is completed.
  const [viewAct, setViewAct] = useState<number>(() => act);
  useEffect(() => {
    setViewAct(act);
  }, [act]);

  return (
    <div className="flex h-full flex-col bg-neo-bg font-display text-neo-ink">
      <header className="flex items-center justify-between gap-2 overflow-x-auto border-b-4 border-black bg-neo-secondary px-3 py-2 md:px-4 [scrollbar-width:none]">
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/" aria-label="Back to home" title="Back to home">
            <motion.img
              src="/logo.svg"
              alt="LeetGraph"
              whileHover={{ rotate: -6, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="h-9 w-9"
            />
          </Link>

          <nav className="flex gap-1.5" aria-label="Primary">
            {(
              [
                { id: "map", label: "Map", icon: <FaMap key="i" /> },
                { id: "analytics", label: "Analytics", icon: <FaChartLine key="i" /> },
                { id: "awards", label: "Awards", icon: <FaTrophy key="i" /> },
                { id: "interview", label: "Interview", icon: <FaUserTie key="i" />, ribbon: true },
              ] as { id: Tab; label: string; icon: React.ReactNode; ribbon?: boolean }[]
            ).map((t) => (
              <motion.button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                whileHover={hover}
                whileTap={tap}
                className={`relative flex items-center gap-1.5 border-4 border-black px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-neo-sm transition-colors duration-100 ${
                  tab === t.id ? "bg-neo-accent text-black" : "bg-white text-black hover:bg-neo-muted"
                }`}
              >
                {t.icon} <span className="hidden sm:inline">{t.label}</span>
                {t.ribbon && (
                  <span className="absolute -right-2.5 -top-2.5 rotate-6 border-2 border-black bg-neo-pink px-1 py-0.5 text-[8px] font-black uppercase text-white shadow-neo-sm">
                    Preview
                  </span>
                )}
              </motion.button>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PlayerStrip rev={rev} />

          <div className="flex items-center gap-1.5">
            <motion.button
              onClick={() => setViewAct((a) => Math.max(0, a - 1))}
              disabled={viewAct === 0}
              aria-label="Previous act"
              whileHover={{ scale: 1.15, x: -2 }}
              whileTap={tap}
              className="grid h-8 w-8 place-items-center border-4 border-black bg-white text-sm font-black shadow-neo-sm transition-colors hover:enabled:bg-neo-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <FaChevronLeft />
            </motion.button>
            <motion.span
              key={viewAct}
              initial={{ rotate: -3, scale: 0.9 }}
              animate={{ rotate: 1, scale: 1 }}
              className="whitespace-nowrap border-4 border-black bg-neo-muted px-2 py-1 text-center text-xs font-black uppercase tracking-wide shadow-neo-sm"
            >
              Act {viewAct + 1}/{totalActs}
            </motion.span>
            <motion.button
              onClick={() => setViewAct((a) => Math.min(act, a + 1))}
              disabled={viewAct >= act}
              aria-label="Next act"
              whileHover={{ scale: 1.15, x: 2 }}
              whileTap={tap}
              className="grid h-8 w-8 place-items-center border-4 border-black bg-white text-sm font-black shadow-neo-sm transition-colors hover:enabled:bg-neo-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <FaChevronRight />
            </motion.button>
          </div>

          <div className="flex items-center gap-1.5 border-4 border-black bg-white px-2 py-1 shadow-neo-sm">
            <FaFire className="text-neo-accent" />
            <div className="hidden h-3.5 w-24 border-2 border-black bg-neo-bg md:block">
              <motion.div
                className="h-full bg-neo-accent"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <motion.span
              key={progress}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="text-xs font-black tabular-nums"
            >
              {progress}%
            </motion.span>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === "map" ? (
          <GraphView map={map} viewAct={viewAct} onAttempt={() => setRev((r) => r + 1)} />
        ) : tab === "analytics" ? (
          <AnalyticsView map={map} />
        ) : tab === "awards" ? (
          <AchievementsView onChanged={() => setRev((r) => r + 1)} />
        ) : (
          <BoneSuspense
            name="interview-room"
            className="flex min-h-0 flex-1 flex-col"
            fallback={
              <div className="grid flex-1 place-items-center">
                <motion.div
                  animate={{ rotate: [-2, 2, -2] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="border-4 border-black bg-neo-secondary px-6 py-4 text-sm font-black uppercase shadow-neo"
                >
                  Setting up the interview room…
                </motion.div>
              </div>
            }
          >
            <InterviewView map={map} onAttempt={() => setRev((r) => r + 1)} />
          </BoneSuspense>
        )}
      </main>

      <Coach />
    </div>
  );
}
