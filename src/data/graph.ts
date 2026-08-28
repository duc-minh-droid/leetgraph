import type { Problem } from "./problems-core";
import type { MapNode, MapData } from "../map";

export const ACTS = 3;
const COLUMNS = 9;
const START_COL = Math.floor((COLUMNS - 1) / 2);
const MAX_NODES = 171; // hard ceiling so we never repeat a problem

export interface GraphJson {
  name: string;
  eloMin: number;
  eloMax: number;
  nodes: MapData;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Slay-the-Spire-style generation, per act:
//   • P = random(2,8) independent walks per act — re-rolled every act, so acts
//     vary from a near-straight double line (P=2) to a wide braid (P=8).
//   • Each walk length is also randomized (random(12,18) rows), so act HEIGHT
//     is derived from the walk, NOT from a fixed row/bucket count — acts are no
//     longer identical rectangles.
//   • Every step drifts ±1 column across the full width (no lanes). Merges are
//     emergent: two walks landing on the same cell share a node at whatever row
//     that happens, so mid-act pinches appear naturally, not just at the top.
//   • All walks funnel into the act's single convergence node, which is bridged
//     to the next act's start. Difficulty is assigned LAST, by global row.
export function buildActsGraph(problems: Problem[], name: string): GraphJson {
  const nodes = new Map<string, MapNode>();
  const ensure = (row: number, col: number, act: number): MapNode => {
    const id = `${row}-${col}`;
    let n = nodes.get(id);
    if (!n) {
      n = { id, row, col, edges_out: [], slug: "", act };
      nodes.set(id, n);
    }
    return n;
  };
  const addEdge = (fromId: string, toId: string) => {
    const f = nodes.get(fromId)!;
    if (!f.edges_out.includes(toId)) f.edges_out.push(toId);
  };

  let cursor = 0; // running global row; acts are contiguous, gap is render-only
  for (let a = 0; a < ACTS; a++) {
    const walkRows = randInt(12, 18); // randomized act height
    const baseRow = cursor;
    const convId = `${baseRow + walkRows}-${START_COL}`;
    ensure(baseRow, START_COL, a); // single start
    ensure(baseRow + walkRows, START_COL, a); // single convergence end

    const spawnWalk = () => {
      let col = START_COL;
      let row = baseRow;
      ensure(row, col, a);
      for (let r = 1; r < walkRows; r++) {
        const nextCol = clamp(col + randInt(-1, 1), 0, COLUMNS - 1);
        const nrow = baseRow + r;
        ensure(nrow, nextCol, a);
        addEdge(`${row}-${col}`, `${nrow}-${nextCol}`);
        col = nextCol;
        row = nrow;
      }
      addEdge(`${row}-${col}`, convId); // every walk converges here
    };

    const P = randInt(2, 8); // re-rolled per act
    for (let i = 0; i < P; i++) spawnWalk();

    // Bridge this act's convergence to the next act's start.
    if (a < ACTS - 1) {
      const nextBase = baseRow + walkRows + 1;
      ensure(nextBase, START_COL, a + 1);
      addEdge(convId, `${nextBase}-${START_COL}`);
      cursor = nextBase;
    } else {
      cursor = baseRow + walkRows + 1;
    }
  }

  // ---- Cleanup passes on the unioned graph ----
  crossRepair(nodes);
  for (const n of nodes.values()) n.edges_out = [...new Set(n.edges_out)];
  // Out-degree is naturally ≤3 (every edge is a ±1 step); cap is a safeguard.
  for (const n of nodes.values()) if (n.edges_out.length > 4) n.edges_out = n.edges_out.slice(0, 4);

  // If we overshot the problem ceiling, trim degree-(1,1) interior detours
  // (rewiring predecessor → successor) until we're at or under it. This only
  // fires when a wide-braid act overflowed; narrow acts are never padded up.
  let guard = 0;
  while (nodes.size > MAX_NODES && guard++ < 10000) {
    const cands = [...nodes.values()].filter((n) => {
      if (n.edges_out.length !== 1) return false;
      const preds = [...nodes.values()].filter((x) => x.edges_out.includes(n.id));
      if (preds.length !== 1) return false;
      const pred = preds[0];
      const succ = nodes.get(n.edges_out[0]);
      if (!succ) return false;
      if (pred.act !== n.act || succ.act !== n.act) return false;
      if (pred.id === succ.id) return false;
      if (pred.edges_out.includes(succ.id)) return false;
      return true;
    });
    if (cands.length === 0) break;
    const n = cands[0];
    const pred = [...nodes.values()].find((x) => x.edges_out.includes(n.id))!;
    const succId = n.edges_out[0];
    pred.edges_out = pred.edges_out.filter((id) => id !== n.id);
    pred.edges_out.push(succId);
    nodes.delete(n.id);
  }

  // Forward reachability from the map start; backward from the boss (final
  // convergence). Delete anything orphaned or dead-ended.
  const startId = `0-${START_COL}`;
  const maxRow = Math.max(...[...nodes.values()].map((n) => n.row));
  const boss = [...nodes.values()].find((n) => n.row === maxRow)!;
  reachablePrune(nodes, startId, boss.id);
  for (const n of nodes.values()) n.edges_out = [...new Set(n.edges_out)];

  // ---- Assign problems by Elo tier across global rows (never before) ----
  const result = [...nodes.values()].sort((x, y) => x.row - y.row || x.col - y.col);
  const totalRows = result.length ? result[result.length - 1].row + 1 : 1;
  const sorted = [...problems].sort((p, q) => p.elo - q.elo);
  const tierPool: Problem[][] = Array.from({ length: totalRows }, () => []);
  sorted.forEach((p, i) => {
    const r = Math.min(totalRows - 1, Math.floor((i / sorted.length) * totalRows));
    tierPool[r].push(p);
  });
  const used = new Set<string>();
  const takeFromTier = (r: number): string => {
    for (let tr = r; tr >= 0; tr--) {
      const idx = tierPool[tr].findIndex((p) => !used.has(p.slug));
      if (idx >= 0) {
        const p = tierPool[tr][idx];
        used.add(p.slug);
        return p.slug;
      }
    }
    for (let tr = r + 1; tr < totalRows; tr++) {
      const idx = tierPool[tr].findIndex((p) => !used.has(p.slug));
      if (idx >= 0) {
        const p = tierPool[tr][idx];
        used.add(p.slug);
        return p.slug;
      }
    }
    return sorted[0].slug;
  };
  for (const n of result) n.slug = takeFromTier(n.row);

  const eloOf = new Map(problems.map((p) => [p.slug, p.elo]));
  const elos = result.map((n) => eloOf.get(n.slug) ?? 0);
  return {
    name,
    eloMin: Math.min(...elos),
    eloMax: Math.max(...elos),
    nodes: result,
  };
}

// Repair visual crossings at each row transition: if source A (left of B) points
// to a column right of B's target, swap the two targets. Pure repair pass — no
// new proximity edges are invented.
function crossRepair(nodes: Map<string, MapNode>) {
  const maxRow = Math.max(...[...nodes.values()].map((n) => n.row));
  const colOf = (id: string) => nodes.get(id)!.col;
  for (let r = 0; r < maxRow; r++) {
    const rowNodes = [...nodes.values()].filter((n) => n.row === r);
    const edges = rowNodes.flatMap((n) => n.edges_out.map((t) => ({ from: n.id, to: t })));
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [fa, ta] = [edges[i].from, edges[i].to];
        const [fb, tb] = [edges[j].from, edges[j].to];
        const ca = colOf(fa), cb = colOf(fb), cta = colOf(ta), ctb = colOf(tb);
        if (ca < cb && cta > ctb) {
          const A = nodes.get(fa)!;
          const B = nodes.get(fb)!;
          A.edges_out = A.edges_out.map((e) => (e === ta ? tb : e));
          B.edges_out = B.edges_out.map((e) => (e === tb ? ta : e));
        }
      }
    }
  }
}

// Keep only nodes reachable forward from `startId` and backward from `bossId`.
function reachablePrune(nodes: Map<string, MapNode>, startId: string, bossId: string) {
  const fwd = new Set<string>([startId]);
  const fq = [startId];
  while (fq.length) {
    const id = fq.shift()!;
    for (const t of nodes.get(id)?.edges_out ?? []) {
      if (!fwd.has(t) && nodes.has(t)) {
        fwd.add(t);
        fq.push(t);
      }
    }
  }
  const rev = new Set<string>([bossId]);
  const rq = [bossId];
  while (rq.length) {
    const id = rq.shift()!;
    for (const n of nodes.values()) {
      if (n.edges_out.includes(id) && !rev.has(n.id)) {
        rev.add(n.id);
        rq.push(n.id);
      }
    }
  }
  for (const id of [...nodes.keys()]) if (!fwd.has(id) || !rev.has(id)) nodes.delete(id);
}
