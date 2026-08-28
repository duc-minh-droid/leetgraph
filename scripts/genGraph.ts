import { readdirSync, readFileSync, writeFileSync } from "fs";
import { parseProblems } from "../src/data/problems-core";
import { buildActsGraph } from "../src/data/graph";

const dir = "maps";
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".csv")) continue;
  const base = file.replace(/\.csv$/, "");
  const label = base[0].toUpperCase() + base.slice(1);
  const text = readFileSync(`${dir}/${file}`, "utf8");
  const problems = parseProblems(text);
  const graph = buildActsGraph(problems, label);
  writeFileSync(`${dir}/${base}.json`, JSON.stringify(graph, null, 2));
  console.log(`wrote maps/${base}.json — ${graph.nodes.length} nodes, elo ${graph.eloMin}–${graph.eloMax}`);
}
