// LeetCode problem data (statement HTML, signature, starter code) downloaded
// ahead of time by scripts/fetchLeetcode.mjs into public/lc/<slug>.json.
import TurndownService from "turndown";

export type Lang = "python" | "rust";

export interface LcMeta {
  name: string;
  params: { name: string; type: string }[];
  return?: { type: string };
  classname?: string;
  manual?: boolean;
  systemdesign?: boolean;
}

export interface LcData {
  slug: string;
  id: string;
  title: string;
  content: string | null;
  metaData: LcMeta | null;
  exampleTestcases: string;
  codeSnippets: { python3?: string; rust?: string };
}

const memo = new Map<string, Promise<LcData>>();
export function loadLc(slug: string): Promise<LcData> {
  let p = memo.get(slug);
  if (!p) {
    p = fetch(`/lc/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`No downloaded data for "${slug}" — run: node scripts/fetchLeetcode.mjs`);
      return r.json();
    });
    p.catch(() => memo.delete(slug));
    memo.set(slug, p);
  }
  return p;
}

export function starterCode(lc: LcData, lang: Lang): string {
  const s = lang === "python" ? lc.codeSnippets.python3 : lc.codeSnippets.rust;
  if (!s) return lang === "python" ? "class Solution:\n    pass\n" : "impl Solution {\n}\n";
  return s.endsWith("\n") ? s : s + "\n";
}

// ---------------- HTML -> Markdown ----------------

const td = new TurndownService({ codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
td.addRule("pre", {
  filter: "pre",
  replacement: (_c, node) => "\n\n```\n" + (node.textContent ?? "").replace(/ /g, " ").trim() + "\n```\n\n",
});
td.addRule("sup", { filter: "sup", replacement: (c) => `^${c}` });
td.addRule("sub", { filter: "sub", replacement: (c) => `_${c}` });
td.addRule("example", {
  filter: (n) => n.nodeName === "STRONG" && (n as HTMLElement).classList?.contains("example"),
  replacement: (c) => `**${c}**`,
});

export function statementMarkdown(lc: LcData): string {
  if (!lc.content) {
    return `**${lc.title}** is a LeetCode Premium problem, so its statement isn't available here. Open it on LeetCode with the link below.`;
  }
  return td
    .turndown(lc.content)
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*(\*\*)?(Example \d+:)(\*\*)?/gm, "**$2**")
    .trim();
}

// Expected outputs printed in the statement, in order ("Output: [0,1]").
export function statementOutputs(lc: LcData): unknown[] {
  if (!lc.content) return [];
  const out: unknown[] = [];
  const re = /<strong>\s*Output:?\s*<\/strong>:?\s*([^\n]*)/g;
  for (const m of lc.content.matchAll(re)) {
    const txt = m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim();
    try {
      out.push(JSON.parse(txt));
    } catch {
      out.push(undefined);
    }
  }
  return out;
}
