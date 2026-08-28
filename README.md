# LEETGRAPH

Grind LeetCode like a roguelike. Pick a company roadmap, climb its acts, and
track every attempt across a Slay-the-Spire-style skill graph.

Each roadmap is generated from a real LeetCode company CSV export through one
pipeline:

```
CSV (export) ──▶ parseProblems ──▶ buildActsGraph ──▶ JSON map
```

- `parseProblems` computes a difficulty-weighted **Elo** (900–2500) per problem
  from acceptance rate, frequency, and difficulty.
- `buildActsGraph` lays problems out as a StS map: randomized independent walks
  per act that funnel into a single convergence node, bridged into the next act.
  Problems are tiered onto nodes by Elo row-by-row, so difficulty ramps upward.

At runtime each map re-parses its own CSV (same protocol) so every node resolves
its title, Elo, difficulty, and topics.

## Routes

- `/` — home: app info + a selection of roadmaps.
- `/map` — redirects to the default roadmap (`/map/amazon`).
- `/map/:mapId` — the graph view (map + analytics tabs).

Roadmaps: `amazon`, `google`, `apple`, `meta`.

## Develop

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run preview  # serve the production build
```

## Regenerate maps

Add or update a company CSV in `maps/` (`<company>.csv`), then run the generator.
It parses every CSV in `maps/`, builds the act graph, and writes `<company>.json`:

```bash
npx tsx scripts/genGraph.ts
```

The JSON holds node layout + slugs only; problem metadata is resolved from the
CSV at runtime, so the CSV stays the source of truth.
