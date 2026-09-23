import { useState, useEffect, useMemo, useRef, lazy, type ReactNode } from "react";
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
  FaWandMagicSparkles,
  FaMountain,
  FaHourglassHalf,
} from "react-icons/fa6";
import { GraphView } from "./components/GraphView";
import { AnalyticsView } from "./components/AnalyticsView";
import { ProfileDrawer, type ProfileTab } from "./components/ProfileDrawer";
import { Coach, useCoachHidden } from "./components/Coach";
import { Popover, HoverCard } from "./components/ui/Popover";
import { NumberTicker } from "./components/ui/NumberTicker";
import { getMap, listMaps, progressOf, currentActOf, requiredLevelFor } from "./state/library";
import { currentEngine, decayCountdown, RANKS } from "./state/rating";
import { equippedTitle } from "./state/achievements";
import { currentStreak } from "./state/analytics";
import { levelInfo, currentLevel } from "./state/xp";
import { getInventory } from "./state/inventory";
import { AMBIENTS, playAmbient, stopAmbient, currentAmbient, onAmbientChange, sfx } from "./lib/sfx";
import { reduceFx, setReduceFx, onReduceFxChange, floatText, pointOf } from "./lib/juice";
import { avatarUrl, ensureAvatar } from "./lib/avatars";
import { pageSwap, spring, tap } from "./lib/motion";

// Heavy tab (CodeMirror + Excalidraw + ElevenLabs SDK) — loaded on demand.
const InterviewView = lazy(() => import("./components/InterviewView"));

type Tab = "map" | "stats" | "interview";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "map", label: "Map", icon: <FaMap /> },
  { id: "stats", label: "Stats", icon: <FaChartLine /> },
  { id: "interview", label: "Interview", icon: <FaUserTie /> },
];

// ---------------- rank pill (everything competitive, one hover away) ----------------

function RankPill({ rev }: { rev: number }) {
  const engine = useMemo(() => currentEngine(), [rev]);
  const rank = RANKS[engine.rankIdx];
  const next = RANKS[engine.rankIdx + 1];
  const decayIn = useMemo(() => decayCountdown(), [rev]);
  const streak = useMemo(() => currentStreak(), [rev]);
  const title = useMemo(() => equippedTitle(), [rev]);
  const lvl = useMemo(() => levelInfo(), [rev]);
  const ref = useRef<HTMLDivElement>(null);

  // Floating ±delta whenever the rating moves.
  const prev = useRef(engine.rating);
  useEffect(() => {
    const d = engine.rating - prev.current;
    prev.current = engine.rating;
    if (d !== 0 && ref.current) {
      const p = pointOf(ref.current);
      floatText(p.x, p.y + 26, `${d > 0 ? "+" : ""}${d}`, {
        bg: d > 0 ? "#4ADE80" : "#FF6B6B",
        color: d > 0 ? "#000" : "#fff",
        rise: -40,
      });
    }
  }, [engine.rating]);

  const toNext = next ? Math.max(0, Math.min(1, (engine.rating - rank.min) / (next.min - rank.min))) : 1;
  const alert = Boolean(engine.promo) || decayIn === 0;

  const card = (
    <div className="w-64 text-[11px] font-bold uppercase">
      <div className="flex items-center justify-between border-b-4 border-black px-3 py-2" style={{ background: rank.color, color: rank.text }}>
        <span className="flex items-center gap-1.5 text-sm font-black">
          <FaRankingStar /> {rank.name}
        </span>
        <span className="text-lg font-black tabular-nums">{engine.rating}</span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="truncate text-black/60">"{title}"</div>
        <div>
          <div className="mb-1 flex justify-between">
            <span>{next ? `Next: ${next.name}` : "Top rank"}</span>
            <span className="tabular-nums">{next ? next.min : "—"}</span>
          </div>
          <div className="h-2.5 border-2 border-black bg-neo-bg">
            <div className="h-full bg-neo-accent" style={{ width: `${toNext * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between">
            <span>Level {lvl.level}</span>
            <span className="tabular-nums">
              {lvl.into}/{lvl.needed} XP
            </span>
          </div>
          <div className="h-2.5 border-2 border-black bg-neo-bg">
            <div className="h-full bg-neo-blue" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <span className="flex items-center gap-1 border-2 border-black px-1.5 py-1">
            <FaFire className="text-neo-orange" /> {streak}d streak
          </span>
          <span className="flex items-center gap-1 border-2 border-black px-1.5 py-1">
            <FaMountain className="text-neo-blue" /> Peak {engine.peakAllTime}
          </span>
        </div>
        {engine.promo && (
          <div className="flex items-center gap-1.5 border-2 border-black bg-black px-2 py-1 text-neo-secondary">
            <FaTrophy /> Promos for {RANKS[engine.promo.target].name}: {engine.promo.wins}W–{engine.promo.losses}L (win 2 of 3)
          </div>
        )}
        {decayIn === 0 ? (
          <div className="flex items-center gap-1.5 border-2 border-black bg-neo-accent px-2 py-1 text-white">
            <FaHourglassHalf /> Decaying −5/day — solve anything
          </div>
        ) : decayIn !== null && decayIn <= 1 ? (
          <div className="flex items-center gap-1.5 border-2 border-black bg-neo-secondary px-2 py-1">
            <FaHourglassHalf /> Decay starts in {decayIn}d
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <HoverCard content={card} align="end">
      <motion.div
        ref={ref}
        whileHover={{ y: -2 }}
        tabIndex={0}
        className="relative flex cursor-default items-stretch border-4 border-black bg-black shadow-neo-sm"
      >
        <span className="flex items-center gap-1 px-1.5 text-[10px] font-black uppercase tracking-widest" style={{ background: rank.color, color: rank.text }}>
          <FaRankingStar /> <span className="hidden sm:inline">{rank.name}</span>
        </span>
        <NumberTicker value={engine.rating} className="px-2 py-1 text-xs font-black text-white" flash={false} />
        {streak > 0 && (
          <span className="hidden items-center gap-0.5 border-l-2 border-white/30 px-1.5 text-[11px] font-black text-neo-orange sm:flex">
            <FaFire /> {streak}
          </span>
        )}
        {alert && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping bg-neo-accent opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 border-2 border-black bg-neo-accent" />
          </span>
        )}
      </motion.div>
    </HoverCard>
  );
}

// ---------------- sound + effects menu ----------------

function SoundMenu({ rev }: { rev: number }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => onAmbientChange(() => force((n) => n + 1)), []);
  useEffect(() => onReduceFxChange(() => force((n) => n + 1)), []);
  const rankIdx = useMemo(() => currentEngine().rankIdx, [rev]);
  const active = currentAmbient();
  const ref = useRef<HTMLButtonElement>(null);
  const calm = reduceFx();

  return (
    <>
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.08, rotate: -4 }}
        whileTap={tap}
        onClick={() => setOpen((o) => !o)}
        aria-label="Sound and effects"
        aria-expanded={open}
        className={`grid h-9 w-9 place-items-center border-4 border-black shadow-neo-sm transition-colors ${
          active ? "bg-neo-blue text-white" : "bg-white hover:bg-neo-muted"
        }`}
      >
        {active ? <FaVolumeHigh className="text-sm" /> : <FaVolumeXmark className="text-sm" />}
      </motion.button>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} className="w-56">
        <div className="border-b-4 border-black bg-neo-secondary px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
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
              className={`flex w-full items-center justify-between border-b-2 border-black px-3 py-2 text-left text-[11px] font-black uppercase ${
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
        <button
          onClick={() => {
            setReduceFx(!calm);
            sfx(calm ? "toggleOn" : "toggleOff", 0.4);
          }}
          aria-pressed={!calm}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-black uppercase hover:bg-neo-bg"
        >
          <span className="flex items-center gap-1.5">
            <FaWandMagicSparkles /> Screen effects
          </span>
          <span className={`border-2 border-black px-1.5 text-[9px] ${calm ? "bg-white" : "bg-neo-ok"}`}>{calm ? "Off" : "On"}</span>
        </button>
      </Popover>
    </>
  );
}

// Avatar with a circular XP ring — opens the Profile drawer.
function AvatarButton({ rev, onClick, active }: { rev: number; onClick: () => void; active: boolean }) {
  const avatar = useMemo(() => {
    void rev;
    return ensureAvatar();
  }, [rev]);
  const lvl = useMemo(() => levelInfo(), [rev]);
  return (
    <motion.button
      onClick={onClick}
      aria-label="Open profile"
      title={`Profile · Level ${lvl.level}`}
      whileHover={{ scale: 1.08, rotate: -4 }}
      whileTap={tap}
      className={`relative h-10 w-10 border-4 border-black shadow-neo-sm ${active ? "bg-neo-accent" : "bg-white"}`}
    >
      <img src={avatarUrl(avatar, 64)} alt="" className="h-full w-full object-cover" />
      <span className="absolute -bottom-2 -right-2 border-2 border-black bg-neo-blue px-1 text-[9px] font-black leading-tight text-white">
        {lvl.level}
      </span>
      {/* XP progress along the bottom edge */}
      <span className="absolute inset-x-0 -bottom-[4px] h-[4px] bg-black">
        <motion.span
          className="block h-full bg-neo-blue"
          initial={false}
          animate={{ width: `${Math.round(lvl.progress * 100)}%` }}
          transition={spring.soft}
        />
      </span>
    </motion.button>
  );
}

// ---------------- shell ----------------

export function MapApp() {
  const { mapId } = useParams();
  const valid = listMaps().some((m) => m.id === mapId);
  // Level gate: locked roadmaps bounce back home.
  if (!valid || currentLevel() < requiredLevelFor(mapId)) return <Navigate to="/" replace />;

  const map = getMap(mapId);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  // Legacy deep links: analytics → stats; awards/shop → profile drawer.
  const [tab, setTabState] = useState<Tab>(
    urlTab === "stats" || urlTab === "analytics" ? "stats" : urlTab === "interview" ? "interview" : "map"
  );
  const [profileOpen, setProfileOpen] = useState(urlTab === "awards" || urlTab === "shop");
  const [profileTab, setProfileTab] = useState<ProfileTab>(urlTab === "shop" ? "shop" : "collection");
  useCoachHidden("profile", profileOpen);

  const setTab = (t: Tab) => {
    if (t === tab) return;
    sfx("tab", 0.3);
    setTabState(t);
    setSearchParams(t === "map" ? {} : { tab: t }, { replace: true });
  };
  useEffect(() => {
    if (urlTab === "awards" || urlTab === "shop" || urlTab === "analytics") {
      setSearchParams(tab === "map" ? {} : { tab }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bumped after every submitted attempt so header progress/act stay live.
  const [rev, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);
  const act = currentActOf(map);
  const progress = progressOf(map);
  const coins = useMemo(() => getInventory().coins, [rev]);
  const totalActs = Math.max(...map.nodes.map((n) => n.act)) + 1;

  const [viewAct, setViewAct] = useState<number>(() => act);
  useEffect(() => {
    setViewAct(act);
  }, [act]);

  return (
    <div className="flex h-full flex-col bg-neo-bg font-display text-neo-ink">
      <header className="relative z-30 flex items-center justify-between gap-2 border-b-4 border-black bg-neo-secondary px-3 py-2 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" aria-label="Back to home" title="All roadmaps" className="flex shrink-0 items-center gap-2">
            <motion.img
              src="/logo.svg"
              alt="LeetGraph"
              whileHover={{ rotate: -10, scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              transition={spring.bouncy}
              className="h-9 w-9"
            />
            <span className="hidden border-2 border-black bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest lg:inline">
              {map.name}
            </span>
          </Link>

          <nav className="hidden items-stretch border-4 border-black bg-white shadow-neo-sm md:flex" aria-label="Primary">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
                  i > 0 ? "border-l-4 border-black" : ""
                } ${tab === t.id ? "" : "text-black/60 hover:bg-neo-bg hover:text-black"}`}
              >
                {tab === t.id && (
                  <motion.span layoutId="main-tab" transition={spring.snappy} className="absolute inset-0 bg-neo-accent" />
                )}
                <span className="relative flex items-center gap-1.5">
                  {t.icon} {t.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RankPill rev={rev} />
          <button
            id="hud-coins"
            onClick={() => {
              setProfileTab("shop");
              setProfileOpen(true);
            }}
            title={`${coins} coins — tap to open the shop`}
            className="flex items-center gap-1 border-4 border-black bg-white px-2 py-1 text-xs font-black shadow-neo-sm transition-colors hover:bg-neo-bg"
          >
            <FaCoins className="text-neo-orange" /> <NumberTicker value={coins} />
          </button>
          <SoundMenu rev={rev} />
          <AvatarButton
            rev={rev}
            active={profileOpen}
            onClick={() => {
              setProfileTab("collection");
              setProfileOpen(true);
            }}
          />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            variants={pageSwap}
            initial="hidden"
            animate="show"
            exit="exit"
            className="flex min-h-0 flex-1 flex-col"
          >
            {tab === "map" ? (
              <GraphView
                map={map}
                viewAct={viewAct}
                maxAct={act}
                totalActs={totalActs}
                progress={progress}
                onViewAct={setViewAct}
                onAttempt={bump}
              />
            ) : tab === "stats" ? (
              <AnalyticsView map={map} rev={rev} onChanged={bump} />
            ) : (
              <BoneSuspense
                name="interview-room"
                className="flex min-h-0 flex-1 flex-col"
                fallback={
                  <div className="grid flex-1 place-items-center">
                    <div className="border-4 border-black bg-neo-secondary px-6 py-4 text-sm font-black uppercase shadow-neo">
                      Setting up the interview room…
                    </div>
                  </div>
                }
              >
                <InterviewView map={map} onAttempt={bump} />
              </BoneSuspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t-4 border-black bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-black uppercase ${
              i > 0 ? "border-l-4 border-black" : ""
            }`}
          >
            {tab === t.id && (
              <motion.span layoutId="main-tab-m" transition={spring.snappy} className="absolute inset-0 bg-neo-accent" />
            )}
            <span className="relative text-base">{t.icon}</span>
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </nav>

      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        tab={profileTab}
        onTab={setProfileTab}
        rev={rev}
        onChanged={bump}
      />

      <Coach />
    </div>
  );
}
