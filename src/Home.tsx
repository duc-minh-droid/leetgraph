import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FaFire, FaMap, FaArrowRight, FaBolt, FaLayerGroup } from "react-icons/fa6";
import { listMaps } from "./state/library";

const CARD_COLORS = [
  "bg-neo-accent",
  "bg-neo-secondary",
  "bg-neo-muted",
  "bg-neo-pink",
];

export function Home() {
  const maps = listMaps();
  const totalProblems = maps.reduce((s, m) => s + m.nodeCount, 0);
  const totalActs = Math.max(...maps.map((m) => m.acts));

  return (
    <div className="min-h-full overflow-y-auto bg-neo-bg bg-grid font-display text-neo-ink">
      <div className="mx-auto max-w-6xl px-5 py-10 md:py-16">
        {/* Hero */}
        <motion.header
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="flex flex-col items-start gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <div className="mb-3 inline-block rotate-[-2deg] border-4 border-black bg-neo-accent px-4 py-2 shadow-neo">
              <span className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">LEET</span>
              <span className="text-3xl font-black uppercase tracking-tight md:text-5xl">GRAPH</span>
            </div>
            <h1 className="max-w-2xl text-2xl font-black uppercase leading-tight tracking-tight md:text-4xl">
              Grind LeetCode like a roguelike. Pick a roadmap, climb the acts.
            </h1>
            <p className="mt-3 max-w-xl text-sm font-bold uppercase tracking-wide text-black/70">
              Every map is generated from a real company problem export — parsed, tiered by Elo, and
              laid out Slay-the-Spire style across {totalActs} acts.
            </p>
          </div>

          <motion.div
            whileHover={{ rotate: 6 }}
            className="hidden shrink-0 grid-cols-1 gap-3 lg:grid"
          >
            <div className="flex items-center gap-2 border-4 border-black bg-neo-secondary px-4 py-2 shadow-neo-sm">
              <FaLayerGroup className="text-neo-ink" />
              <span className="text-sm font-black uppercase">{maps.length} Roadmaps</span>
            </div>
            <div className="flex items-center gap-2 border-4 border-black bg-neo-muted px-4 py-2 shadow-neo-sm">
              <FaBolt className="text-neo-ink" />
              <span className="text-sm font-black uppercase">{totalProblems} Problems</span>
            </div>
            <div className="flex items-center gap-2 border-4 border-black bg-neo-pink px-4 py-2 shadow-neo-sm">
              <FaFire className="text-white" />
              <span className="text-sm font-black uppercase">{totalActs} Acts each</span>
            </div>
          </motion.div>
        </motion.header>

        {/* Map selection */}
        <section className="mt-12">
          <div className="mb-5 flex items-center gap-2">
            <FaMap className="text-2xl text-neo-accent" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Choose your roadmap</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {maps.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 22 }}
                whileHover={{ y: -6, rotate: i % 2 === 0 ? -1 : 1 }}
                className="flex flex-col border-4 border-black bg-white shadow-neo"
              >
                <div className={`h-3 w-full ${CARD_COLORS[i % CARD_COLORS.length]}`} />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <h3 className="text-xl font-black uppercase leading-none tracking-tight">{m.name}</h3>
                  <p className="flex-1 text-xs font-bold uppercase leading-snug text-black/70">{m.description}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase">
                    <span className="border-2 border-black bg-neo-bg px-2 py-0.5">{m.nodeCount} nodes</span>
                    <span className="border-2 border-black bg-neo-bg px-2 py-0.5">{m.acts} acts</span>
                    <span className="border-2 border-black bg-neo-bg px-2 py-0.5">
                      elo {m.eloMin}–{m.eloMax}
                    </span>
                  </div>
                  <Link
                    to={`/map/${m.id}`}
                    className="mt-1 flex items-center justify-center gap-2 border-4 border-black bg-neo-accent px-4 py-2 text-sm font-black uppercase shadow-neo-sm transition-all duration-100 ease-linear active:translate-x-[3px] active:translate-y-[3px] active:shadow-none hover:bg-neo-secondary"
                  >
                    Start <FaArrowRight />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <footer className="mt-14 border-t-4 border-black pt-5 text-xs font-bold uppercase tracking-wide text-black/60">
          LEETGRAPH — study roadmaps, not just problems.
        </footer>
      </div>
    </div>
  );
}
