import { readdirSync, readFileSync, writeFileSync } from "fs";
import { parseProblems } from "../src/data/problems-core";
import { buildActsGraph } from "../src/data/graph";

const dir = "maps";
// Only regenerate the maps named on the command line (default: all) — layouts are random,
// so regenerating a map reshuffles it for everyone.
const only = process.argv.slice(2);
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".csv")) continue;
  if (only.length && !only.includes(file.replace(/\.csv$/, ""))) continue;
  const base = file.replace(/\.csv$/, "");
  const label = base[0].toUpperCase() + base.slice(1);
  const text = readFileSync(`${dir}/${file}`, "utf8");
  const problems = parseProblems(text);
  let graph = buildActsGraph(problems, label);
  if (base === "custom") {
    // Small hand-picked set: every problem appears exactly once, so retry the
    // (random) layout until it has exactly one node per problem.
    for (let i = 0; i < 20000 && graph.nodes.length !== problems.length; i++) {
      graph = buildActsGraph(problems, label, { walkRows: [3, 5], walks: [1, 3], maxNodes: problems.length, jitter: 0.35 });
    }
    if (graph.nodes.length !== problems.length) throw new Error("could not fit custom map");
  }
  writeFileSync(`${dir}/${base}.json`, JSON.stringify(graph, null, 2));
  console.log(`wrote maps/${base}.json — ${graph.nodes.length} nodes, elo ${graph.eloMin}–${graph.eloMax}`);
}
