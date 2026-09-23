// Demo seeder for screenshots / local UI work. Paste into the browser console
// on the dev server (local-only mode, no Supabase), then reload:
//
//   const s = await import("/scripts/seedDemo.js"); await s.seed(); location.reload();
//
// Writes a realistic ~60-day attempt log walking the Amazon roadmap (act 1
// cleared, act 2 in progress), plus a stocked inventory. Wipe with s.clear().
export async function seed() {
  const map = await (await fetch("/maps/amazon.json")).json();
  const nodes = Array.isArray(map) ? map : map.nodes;
  const parents = new Map();
  nodes.forEach((n) => n.edges_out.forEach((t) => parents.set(t, [...(parents.get(t) ?? []), n.id])));

  let s = 42;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  // Walk the graph in row order: take most reachable nodes in act 0 (incl.
  // its boss), then ~45% of act 1.
  const visited = new Set();
  const sorted = [...nodes].sort((a, b) => a.row - b.row || a.col - b.col);
  const endRow0 = Math.max(...nodes.filter((n) => n.act === 0).map((n) => n.row));
  const reachable = (n) => n.row === 0 || (parents.get(n.id) ?? []).some((p) => visited.has(p));
  for (const n of sorted) {
    if (n.act > 1 || !reachable(n)) continue;
    const keep = n.act === 0 ? (n.row < 5 ? 1 : 0.88) : n.row < 28 ? 0.6 : 0;
    if (rnd() < keep) visited.add(n.id);
  }
  // Guarantee the act-1 boss is cleared: backfill one parent chain to it.
  const boss = nodes.find((n) => n.act === 0 && n.row === endRow0);
  let cur = boss;
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    const ps = parents.get(cur.id) ?? [];
    if (ps.some((p) => visited.has(p))) break;
    cur = nodes.find((n) => n.id === ps[0]);
  }
  // Re-run act 2 now that the gate is open.
  for (const n of sorted) {
    if (n.act === 1 && !visited.has(n.id) && n.row < 28 && reachable(n) && rnd() < 0.6) visited.add(n.id);
  }
  const order = sorted.filter((n) => visited.has(n.id));

  const DAY = 86400000;
  const now = Date.now();
  const days = 58;
  const log = {};
  const push = (slug, a) => (log[slug] ??= []).push(a);
  const failModes = ["wrong-answer", "tle", "runtime-error", "compile-error"];
  const retry = [];

  order.forEach((n, i) => {
    const t = i / order.length; // 0 → 1 over the run: you get better
    // Last week is dense so the streak + calendar light up.
    const dayAgo = i > order.length - 14 ? Math.floor((order.length - 1 - i) / 2) : Math.round(days - t * (days - 7));
    const at = now - dayAgo * DAY - Math.floor(rnd() * 8) * 3600000;
    const roll = rnd();
    const pFail = 0.28 - t * 0.18;
    const pHelp = 0.22 - t * 0.12;
    const result = roll < pFail ? (rnd() < 0.8 ? "gave_up" : "abandoned") : roll < pFail + pHelp ? "solved_with_help" : "solved";
    const failed = result === "gave_up" || result === "abandoned";
    const read = Math.round(240 - t * 120 + rnd() * 120);
    const write = Math.round(600 - t * 250 + rnd() * 300);
    const debug = Math.round((failed ? 700 : 420) * (1 - t * 0.6) * (0.4 + rnd()));
    const hints = result === "solved_with_help" && rnd() < 0.7;
    push(n.slug, {
      result,
      time: read + write + debug,
      hints,
      ai: result === "solved_with_help" && !hints,
      verified: !failed && rnd() < 0.6,
      note: "",
      at,
      readTime: read,
      writeTime: write,
      debugTime: debug,
      failureMode: failed ? failModes[Math.floor(rnd() * (t > 0.5 ? 2 : 4))] : null,
      timeComplexity: failed ? "" : ["O(n)", "O(n log n)", "O(n)", "O(1)"][Math.floor(rnd() * 4)],
      spaceComplexity: failed ? "" : ["O(1)", "O(n)"][Math.floor(rnd() * 2)],
      optimal: !failed && rnd() < 0.3 + t * 0.5,
      xp: failed ? 5 : 20,
    });
    if (failed && dayAgo > 6) retry.push({ slug: n.slug, at });
  });

  // Rematches: older fails beaten a few days later (retry table + comeback).
  retry.forEach((r, i) => {
    const at = Math.min(now - DAY, r.at + (3 + (i % 4)) * DAY);
    push(r.slug, {
      result: i % 3 === 2 ? "solved_with_help" : "solved",
      time: 700,
      hints: i % 3 === 2,
      ai: false,
      verified: true,
      note: "rematch",
      at,
      readTime: 120,
      writeTime: 420,
      debugTime: 160,
      failureMode: null,
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
      optimal: true,
      xp: 25,
    });
  });
  Object.values(log).forEach((list) => list.sort((a, b) => a.at - b.at));

  localStorage.setItem("leegraph.attempts", JSON.stringify(log));
  localStorage.setItem(
    "leetgraph.inventory",
    JSON.stringify({
      relics: ["rubber-duck", "warm-coffee", "xp-charm", "lucky-coin", "scholars-tome", "sturdy-helm"],
      potions: ["second-chance", "small-tonic", "small-tonic", "quest-reroll"],
      curse: null,
      pendingBonus: 0,
      pendingChest: null,
      questRerolls: {},
      eventsSeen: [],
      coins: 385,
      avatars: ["adventurer:demo-hero", "pixel-art:lg-1", "bottts:lg-2", "notionists:lg-3", "big-smile:lg-4"],
      avatar: "adventurer:demo-hero",
      effects: [{ id: "focus", uses: 2 }],
      bundlesBought: [],
      questsClaimed: [],
    })
  );
  return { nodes: order.length, attempts: Object.values(log).flat().length };
}

export function clear() {
  ["leegraph.attempts", "leetgraph.inventory", "leetgraph.title", "leetgraph.coachSkin", "leetgraph.questboard.v1"].forEach((k) =>
    localStorage.removeItem(k)
  );
}
