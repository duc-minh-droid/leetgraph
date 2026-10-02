// Builds maps/custom.csv from a hand-picked list of LeetCode problems (title,
// difficulty, acceptance and topics come from LeetCode's GraphQL API).
// Frequency isn't published, so every problem gets the same value and Elo is
// driven by acceptance + difficulty. Then run: npx vite-node scripts/genGraph.ts
import { writeFileSync } from "node:fs";

const PICKS = [
  // graphs & grids
  [200, "number-of-islands"], [695, "max-area-of-island"], [994, "rotting-oranges"], [133, "clone-graph"],
  [207, "course-schedule"], [210, "course-schedule-ii"], [743, "network-delay-time"], [1091, "shortest-path-in-binary-matrix"],
  // trees
  [104, "maximum-depth-of-binary-tree"], [226, "invert-binary-tree"], [102, "binary-tree-level-order-traversal"],
  [98, "validate-binary-search-tree"], [236, "lowest-common-ancestor-of-a-binary-tree"],
  // linked lists
  [206, "reverse-linked-list"], [21, "merge-two-sorted-lists"], [141, "linked-list-cycle"],
  // design
  [146, "lru-cache"], [362, "design-hit-counter"], [981, "time-based-key-value-store"], [380, "insert-delete-getrandom-o1"],
];

const Q = `query q($s:String!){question(titleSlug:$s){questionFrontendId title difficulty stats topicTags{name}}}`;
const esc = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const rows = ["Difficulty,Title,Frequency,Acceptance Rate,Link,Topics"];
for (const [id, slug] of PICKS) {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query: Q, variables: { s: slug } }),
  });
  const q = (await res.json()).data?.question;
  if (!q) throw new Error(`not found: ${slug}`);
  if (Number(q.questionFrontendId) !== id) throw new Error(`${slug} is #${q.questionFrontendId}, expected #${id}`);
  const ac = parseFloat(JSON.parse(q.stats).acRate) / 100;
  rows.push(
    [q.difficulty.toUpperCase(), esc(q.title), "50.0", ac, `https://leetcode.com/problems/${slug}`, esc(q.topicTags.map((t) => t.name).join(", "))].join(",")
  );
  await new Promise((r) => setTimeout(r, 300));
}
writeFileSync("maps/custom.csv", rows.join("\n") + "\n");
console.log(`wrote maps/custom.csv — ${PICKS.length} problems`);
