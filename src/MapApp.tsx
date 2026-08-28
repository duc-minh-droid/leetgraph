import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams, Navigate } from "react-router-dom";
import {
  FaMap,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaBrain,
  FaFire,
  FaArrowLeft,
} from "react-icons/fa6";
import { GraphView } from "./components/GraphView";
import { AnalyticsView } from "./components/AnalyticsView";
import { getMap, listMaps, progressOf, currentActOf } from "./state/library";

type Tab = "map" | "analytics";

const tap = { scale: 0.94 };
const hover = { scale: 1.04 };

export function MapApp() {
  const { mapId } = useParams();
  const valid = listMaps().some((m) => m.id === mapId);
  if (!valid) return <Navigate to="/" replace />;

  const map = getMap(mapId);
  const [tab, setTab] = useState<Tab>("map");
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-black bg-neo-secondary px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="grid rotate-[-2deg] place-items-center border-4 border-black bg-neo-accent p-2 shadow-neo-sm transition-transform hover:rotate-0"
          >
            <FaArrowLeft className="text-xl text-white" />
          </Link>

          <motion.div
            whileHover={hover}
            whileTap={tap}
            className="grid rotate-[-2deg] place-items-center border-4 border-black bg-neo-accent p-2 shadow-neo-sm"
          >
            <FaBrain className="text-2xl text-white" />
          </motion.div>

          <nav className="flex gap-2" aria-label="Primary">
            <motion.button
              onClick={() => setTab("map")}
              aria-pressed={tab === "map"}
              whileHover={hover}
              whileTap={tap}
              className={`flex items-center gap-2 border-4 border-black px-4 py-2 text-sm font-black uppercase tracking-wide shadow-neo-sm transition-colors duration-100 ${
                tab === "map" ? "bg-neo-accent text-black" : "bg-white text-black hover:bg-neo-muted"
              }`}
            >
              <FaMap /> Map
            </motion.button>
            <motion.button
              onClick={() => setTab("analytics")}
              aria-pressed={tab === "analytics"}
              whileHover={hover}
              whileTap={tap}
              className={`flex items-center gap-2 border-4 border-black px-4 py-2 text-sm font-black uppercase tracking-wide shadow-neo-sm transition-colors duration-100 ${
                tab === "analytics" ? "bg-neo-accent text-black" : "bg-white text-black hover:bg-neo-muted"
              }`}
            >
              <FaChartLine /> Analytics
            </motion.button>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <span className="hidden max-w-[200px] items-center gap-1 truncate border-4 border-black bg-neo-muted px-3 py-1 text-sm font-black uppercase tracking-wide shadow-neo-sm rotate-[-1deg] sm:flex">
            <FaMap className="text-neo-accent" /> {map.name}
          </span>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setViewAct((a) => Math.max(0, a - 1))}
              disabled={viewAct === 0}
              aria-label="Previous act"
              whileTap={tap}
              className="grid h-10 w-10 place-items-center border-4 border-black bg-white text-xl font-black shadow-neo-sm transition-colors hover:enabled:bg-neo-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <FaChevronLeft />
            </motion.button>
            <motion.span
              key={viewAct}
              initial={{ rotate: -3, scale: 0.9 }}
              animate={{ rotate: 1, scale: 1 }}
              className="min-w-[110px] border-4 border-black bg-neo-muted px-3 py-1 text-center text-sm font-black uppercase tracking-wide shadow-neo-sm"
            >
              Act {viewAct + 1}/{totalActs}
            </motion.span>
            <motion.button
              onClick={() => setViewAct((a) => Math.min(act, a + 1))}
              disabled={viewAct >= act}
              aria-label="Next act"
              whileTap={tap}
              className="grid h-10 w-10 place-items-center border-4 border-black bg-white text-xl font-black shadow-neo-sm transition-colors hover:enabled:bg-neo-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <FaChevronRight />
            </motion.button>
          </div>

          <div className="flex items-center gap-2 border-4 border-black bg-white px-3 py-1 shadow-neo-sm">
            <FaFire className="text-neo-accent" />
            <div className="h-4 w-36 border-2 border-black bg-neo-bg">
              <div className="h-full bg-neo-accent" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-black tabular-nums">{progress}%</span>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === "map" ? (
          <GraphView map={map} viewAct={viewAct} />
        ) : (
          <AnalyticsView map={map} />
        )}
      </main>
    </div>
  );
}
