import type { MapData } from "../../map";

export const ROW_HEIGHT = 200;
export const COL_WIDTH = 230;
export const SQ_W = 168;
export const SQ_H = 112;
export const ACT_GAP = 320; // visible break between acts in the layout

// Stable per-node pixel jitter (seeded by id) so nodes sit off-grid like real
// StS maps instead of perfect columns. Deterministic across renders.
function jitter(id: string, range: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 2 * range;
}

// Node centers in flow coordinates. Row 0 sits at the bottom; acts stack up.
export function layout(map: MapData) {
  const rows = Math.max(...map.map((n) => n.row)) + 1;
  const pos = new Map<string, { x: number; y: number }>();
  map.forEach((n) => {
    const x = n.col * COL_WIDTH + SQ_W / 2 + jitter(n.id + "x", 12);
    const y = (rows - 1 - n.row) * ROW_HEIGHT + SQ_H / 2 - n.act * ACT_GAP + jitter(n.id + "y", 12);
    pos.set(n.id, { x, y });
  });
  return pos;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boundsOf(ids: string[], pos: Map<string, { x: number; y: number }>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const p = pos.get(id);
    if (!p) continue;
    minX = Math.min(minX, p.x - SQ_W / 2);
    maxX = Math.max(maxX, p.x + SQ_W / 2);
    minY = Math.min(minY, p.y - SQ_H / 2);
    maxY = Math.max(maxY, p.y + SQ_H / 2);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
