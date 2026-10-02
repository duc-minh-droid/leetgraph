// Downloads real statements, signatures and starter code from LeetCode for
// every problem in maps/*.csv into public/lc/<slug>.json (committed; served
// statically so the app never scrapes at runtime).
//   node scripts/fetchLeetcode.mjs          # fetch missing only
//   node scripts/fetchLeetcode.mjs --force  # refetch all
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";

const OUT = "public/lc";
const force = process.argv.includes("--force");
mkdirSync(OUT, { recursive: true });

const slugs = new Set();
for (const f of readdirSync("maps").filter((f) => f.endsWith(".csv"))) {
  for (const m of readFileSync(`maps/${f}`, "utf8").matchAll(/leetcode\.com\/problems\/([a-z0-9-]+)/g)) slugs.add(m[1]);
}

const QUERY = `query q($s:String!){question(titleSlug:$s){questionId title content metaData exampleTestcases codeSnippets{langSlug code}}}`;
const KEEP = new Set(["python3", "rust"]);

async function fetchOne(slug) {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query: QUERY, variables: { s: slug } }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const q = (await res.json()).data?.question;
  if (!q) throw new Error("not found");
  return {
    slug,
    id: q.questionId,
    title: q.title,
    content: q.content, // null for premium-only problems
    metaData: q.metaData ? JSON.parse(q.metaData) : null,
    exampleTestcases: q.exampleTestcases,
    codeSnippets: Object.fromEntries((q.codeSnippets ?? []).filter((c) => KEEP.has(c.langSlug)).map((c) => [c.langSlug, c.code])),
  };
}

let ok = 0, skipped = 0, failed = [];
for (const slug of [...slugs].sort()) {
  const file = `${OUT}/${slug}.json`;
  if (!force && existsSync(file)) { skipped++; continue; }
  try {
    writeFileSync(file, JSON.stringify(await fetchOne(slug)));
    ok++;
  } catch (e) {
    failed.push(`${slug}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 350));
}
console.log(`fetched ${ok}, skipped ${skipped}, failed ${failed.length}`);
if (failed.length) console.log(failed.join("\n"));
