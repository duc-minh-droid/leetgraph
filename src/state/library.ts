import amazonData from "../../maps/amazon.json";
import googleData from "../../maps/google.json";
import appleData from "../../maps/apple.json";
import metaData from "../../maps/meta.json";
import amazonCsv from "../../maps/amazon.csv?raw";
import googleCsv from "../../maps/google.csv?raw";
import appleCsv from "../../maps/apple.csv?raw";
import metaCsv from "../../maps/meta.csv?raw";
import type { MapData } from "../map";
import { parseProblems, type Problem } from "../data/problems-core";
import { touchedSlugs } from "./attempts";

export interface MapMeta {
  id: string;
  name: string;
  description: string;
  nodes: MapData;
  problems: Record<string, Problem>;
  eloMin: number;
  eloMax: number;
  createdAt: number;
}

interface MapJson {
  name: string;
  eloMin: number;
  eloMax: number;
  nodes: MapData;
}

interface Descriptor {
  id: string;
  description: string;
  json: unknown;
  csv: string;
}

// Every roadmap is built from the same pipeline: CSV (LeetCode export) ->
// parseProblems -> buildActsGraph (acts + Slay-the-Spire style layout) -> JSON.
// We parse the matching CSV at runtime too so each node can resolve its problem
// metadata (title / elo / difficulty / topics) — the JSON stores only slugs.
const DESCRIPTORS: Descriptor[] = [
  {
    id: "amazon",
    description: "The Amazon grind — arrays through DP, tuned to Amazon's most-asked sets.",
    json: amazonData,
    csv: amazonCsv,
  },
  {
    id: "google",
    description: "Google's signal — heavy on graphs, trees, and system-style coding.",
    json: googleData,
    csv: googleCsv,
  },
  {
    id: "apple",
    description: "Apple's loop — pragmatic, product-minded problem sets.",
    json: appleData,
    csv: appleCsv,
  },
  {
    id: "meta",
    description: "Meta's bread and butter — trees, graphs, and classic FAANG rounds.",
    json: metaData,
    csv: metaCsv,
  },
];

// Parsing a CSV per call is wasteful — derived systems (rating, achievements)
// rebuild maps often, so cache by id. Maps are immutable at runtime.
const buildCache = new Map<string, MapMeta>();

function build(id: string, json: unknown, csv: string): MapMeta {
  const cached = buildCache.get(id);
  if (cached) return cached;
  const j = json as MapJson;
  const problems = parseProblems(csv);
  const bySlug: Record<string, Problem> = Object.fromEntries(
    problems.map((p) => [p.slug, p])
  );
  const meta: MapMeta = {
    id,
    name: j.name,
    description: DESCRIPTORS.find((d) => d.id === id)?.description ?? "",
    nodes: j.nodes,
    problems: bySlug,
    eloMin: j.eloMin,
    eloMax: j.eloMax,
    createdAt: Date.now(),
  };
  buildCache.set(id, meta);
  return meta;
}

export function listMaps() {
  return DESCRIPTORS.map((d) => {
    const m = build(d.id, d.json, d.csv);
    const acts = Math.max(...m.nodes.map((n) => n.act)) + 1;
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      eloMin: m.eloMin,
      eloMax: m.eloMax,
      nodeCount: m.nodes.length,
      acts,
      progress: progressOf(m),
    };
  });
}

export function getMap(id?: string | null): MapMeta {
  const desc = DESCRIPTORS.find((d) => d.id === id) ?? DESCRIPTORS[0];
  return build(desc.id, desc.json, desc.csv);
}

export function progressOf(map: MapMeta): number {
  const touched = touchedSlugs();
  if (map.nodes.length === 0) return 0;
  const hit = map.nodes.filter((n) => touched.has(n.slug)).length;
  return Math.round((hit / map.nodes.length) * 100);
}

export function isComplete(map: MapMeta): boolean {
  return progressOf(map) >= 100;
}

// Deepest touched node decides the current act (mirrors the layout logic in
// GraphView so the navbar can show act progress without mounting the graph).
export function currentActOf(map: MapMeta): number {
  const touched = touchedSlugs();
  const data = map.nodes;
  let best: string | null = null;
  let bestRow = -1;
  for (const n of data) {
    if (touched.has(n.slug) && n.row > bestRow) {
      bestRow = n.row;
      best = n.id;
    }
  }
  if (best === null) return 0;
  const cn = data.find((n) => n.id === best)!;
  let act = cn.act;
  const atGate = cn.edges_out.some((t) => {
    const tn = data.find((n) => n.id === t);
    return tn ? tn.act > act : false;
  });
  const total = Math.max(...data.map((n) => n.act)) + 1;
  return atGate ? Math.min(total - 1, act + 1) : act;
}
