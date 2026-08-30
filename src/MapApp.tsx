import { useState, useEffect, useMemo, useRef, lazy } from "react";
import { BoneSuspense } from "boneyard-js/react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useParams, useSearchParams, Navigate } from "react-router-dom";
import {
  FaMap,
  FaChartLine,
  FaFire,
  FaUserTie,
  FaRankingStar,
  FaTrophy,
  FaVolumeHigh,
  FaVolumeXmark,
  FaLock,
  FaCoins,
  FaShop,
} from "react-icons/fa6";
import { GraphView } from "./components/GraphView";
import { AnalyticsView } from "./components/AnalyticsView";
import { AchievementsView } from "./components/AchievementsView";
import { ShopView } from "./components/ShopView";
import { Coach } from "./components/Coach";
import { getMap, listMaps, progressOf, currentActOf, requiredLevelFor } from "./state/library";
import { currentEngine, decayCountdown, RANKS } from "./state/rating";
import { equippedTitle } from "./state/achievements";
import { currentStreak } from "./state/analytics";
import { levelInfo, currentLevel } from "./state/xp";
import { getInventory } from "./state/inventory";
import { AMBIENTS, playAmbient, stopAmbient, currentAmbient, onAmbientChange, sfx } from "./lib/sfx";
import { avatarUrl, ensureAvatar } from "./lib/avatars";

// Heavy tab (CodeMirror + Excalidraw + ElevenLabs SDK) — loaded on demand.
const InterviewView = lazy(() => import("./components/InterviewView"));

type Tab = "map" | "analytics" | "awards" | "shop" | "interview";

const tap = { scale: 0.94 };
const hover = { scale: 1.04 };

// Rank badge (with animated ± delta) · promo series · streak.
function PlayerStrip({ rev }: { rev: number }) {
  const engine = useMemo(() => currentEngine(), [rev]);
  const rating = engine.rating;
  const rank = RANKS[engine.rankIdx];
  const lvl = useMemo(() => levelInfo(), [rev]);
  const decayIn = useMemo(() => decayCountdown(), [rev]);
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
        title={`${rank.name} — ${rating} rating, playing as "${title}". Next rank at ${
          RANKS[engine.rankIdx + 1]?.min ?? "—"
        }.${decayIn === 0 ? " DECAYING −5/day — go solve something!" : ""}`}
      >
        <span
          className="flex items-center gap-1 px-1.5 text-[10px] font-black uppercase tracking-widest"
          style={{ background: rank.color, color: rank.text }}
        >
          <FaRankingStar /> {rank.name}
        </span>
        <motion.span
          key={rating}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          className="px-2 py-1 text-xs font-black tabular-nums text-white"
        >
          {rating}
        </motion.span>
        {decayIn === 0 && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="flex items-center bg-neo-accent px-1 text-[9px] font-black uppercase text-white"
            title="Inactivity decay is draining your rating — solve anything to stop it"
          >
            −5/d
          </motion.span>
        )}
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

      <motion.div
        whileHover={{ y: -2, rotate: 1 }}
        title={`Level ${lvl.level} — ${lvl.into}/${lvl.needed} XP to level ${lvl.level + 1}. Every attempt earns XP.`}
        className="flex items-center gap-1.5 border-4 border-black bg-white px-2 py-1 shadow-neo-sm"
      >
        <motion.span key={lvl.level} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-xs font-black uppercase">
          Lv{lvl.level}
        </motion.span>
        <span className="h-2.5 w-10 border-2 border-black bg-neo-bg">
          <motion.span
            className="block h-full bg-neo-blue"
            initial={false}
            animate={{ width: `${Math.round(lvl.progress * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </span>
      </motion.div>

      {engine.promo && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [-2, 2, -2] }}
          transition={{ rotate: { duration: 1.2, repeat: Infinity } }}
          title={`PROMOTION SERIES for ${RANKS[engine.promo.target].name}: win 2 of 3. Currently ${engine.promo.wins}W–${engine.promo.losses}L.`}
          className="flex items-center gap-1 border-4 border-black bg-black px-2 py-1 text-[10px] font-black uppercase text-neo-secondary shadow-neo-sm"
        >
          <FaTrophy /> Promos {engine.promo.wins}–{engine.promo.losses}
        </motion.span>
      )}

      {streak > 0 && (
        <motion.span
          whileHover={{ y: -2, rotate: 2, scale: 1.06 }}
          title={`${streak}-day practice streak — it also defends your rating from decay`}
          className="flex items-center gap-1 border-4 border-black bg-white px-2 py-1 text-xs font-black shadow-neo-sm"
        >
          <FaFire className="text-neo-orange" /> {streak}
        </motion.span>
      )}

    </div>
  );
}

// Rank-gated ambient soundscapes — each promotion unlocks a new loop.
function AmbientPicker({ rev }: { rev: number }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => onAmbientChange(() => force((n) => n + 1)), []);
  const rankIdx = useMemo(() => currentEngine().rankIdx, [rev]);
  const active = currentAmbient();

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.1, rotate: -3 }}
        whileTap={tap}
        onClick={() => setOpen((o) => !o)}
        aria-label="Ambient sounds"
        title="Ambient soundscapes — unlock one with every rank"
        className={`grid h-8 w-8 place-items-center border-4 border-black shadow-neo-sm transition-colors ${
          active ? "bg-neo-blue text-white" : "bg-white hover:bg-neo-muted"
        }`}
      >
        {active ? <FaVolumeHigh className="text-sm" /> : <FaVolumeXmark className="text-sm" />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.9 }}
            className="absolute right-0 top-11 z-50 w-48 border-4 border-black bg-white shadow-neo"
          >
            <div className="border-b-2 border-black bg-neo-secondary px-2 py-1 text-[10px] font-black uppercase tracking-widest">
              Soundscapes
            </div>
            {AMBIENTS.map((a) => {
              const unlocked = rankIdx >= a.rankIdx;
              const playing = active === a.sound;
              return (
                <button
                  key={a.sound}
                  disabled={!unlocked}
                  onClick={() => {
                    if (playing) {
                      stopAmbient();
                      sfx("toggleOff", 0.4);
                    } else {
                      playAmbient(a.sound);
                      sfx("toggleOn", 0.4);
                    }
                  }}
                  title={unlocked ? a.label : `Reach ${RANKS[a.rankIdx].name} to unlock`}
                  className={`flex w-full items-center justify-between border-b-2 border-black px-2 py-1.5 text-left text-[11px] font-black uppercase last:border-b-0 ${
                    playing ? "bg-neo-blue text-white" : unlocked ? "hover:bg-neo-bg" : "text-black/35"
                  }`}
                >
                  <span>{a.label}</span>
                  {!unlocked ? (
                    <span className="flex items-center gap-1 text-[9px]">
                      <FaLock /> {RANKS[a.rankIdx].name}
                    </span>
                  ) : playing ? (
                    <FaVolumeHigh className="text-[10px]" />
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MapApp() {
  const { mapId } = useParams();
  const valid = listMaps().some((m) => m.id === mapId);
  // Level gate: locked roadmaps bounce back home.
  if (!valid || currentLevel() < requiredLevelFor(mapId)) return <Navigate to="/" replace />;

  const map = getMap(mapId);
  // Tab is deep-linkable (?tab=interview) — also lets the boneyard capture
  // browser reach every tab for skeleton generation.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTabState] = useState<Tab>(
    urlTab === "analytics" || urlTab === "interview" || urlTab === "awards" || urlTab === "shop"
      ? urlTab
      : "map"
  );
  const setTab = (t: Tab) => {
    setTabState(t);
    setSearchParams(t === "map" ? {} : { tab: t }, { replace: true });
  };
  // Bumped after every submitted attempt so header progress/act stay live.
  const [rev, setRev] = useState(0);
  const act = currentActOf(map);
  const progress = progressOf(map);
  // Identity + wallet (avatar assigned on first visit if none yet).
  const avatar = useMemo(() => ensureAvatar(), [rev]);
  const coins = useMemo(() => getInventory().coins, [rev]);
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
                { id: "shop", label: "Shop", icon: <FaShop key="i" /> },
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

          <motion.span
            whileHover={{ y: -2, rotate: 2 }}
            title={`${coins} coins — earn by solving, spend in the avatar shop (Profile)`}
            className="flex items-center gap-1 border-4 border-black bg-neo-secondary px-2 py-1 text-xs font-black tabular-nums shadow-neo-sm"
          >
            <FaCoins /> {coins}
          </motion.span>

          <AmbientPicker rev={rev} />

          <motion.button
            onClick={() => setTab("awards")}
            aria-pressed={tab === "awards"}
            aria-label="Profile"
            title="Profile — avatars, achievements, seasons, coach locker"
            whileHover={{ scale: 1.12, rotate: -3 }}
            whileTap={tap}
            className={`h-9 w-9 overflow-hidden border-4 border-black shadow-neo-sm transition-colors ${
              tab === "awards" ? "bg-neo-accent" : "bg-white"
            }`}
          >
            <img src={avatarUrl(avatar, 64)} alt="Your avatar" className="h-full w-full object-cover" />
          </motion.button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === "map" ? (
          <GraphView
            map={map}
            viewAct={viewAct}
            maxAct={act}
            totalActs={totalActs}
            progress={progress}
            onViewAct={setViewAct}
            onAttempt={() => setRev((r) => r + 1)}
          />
        ) : tab === "analytics" ? (
          <AnalyticsView map={map} />
        ) : tab === "awards" ? (
          <AchievementsView onChanged={() => setRev((r) => r + 1)} />
        ) : tab === "shop" ? (
          <ShopView onChanged={() => setRev((r) => r + 1)} />
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
