// Machine-checkable problem spec. Signature + example inputs/outputs come from
// the downloaded LeetCode data (authoritative). Only what LeetCode doesn't
// publish — hidden edge-case inputs and a reference solution (to derive their
// expected outputs) — is generated, once per problem, via Groq and cached.
import { askJson } from "./groq";
import { statementMarkdown, statementOutputs, type LcData } from "./lc";

export type Compare = "exact" | "unordered" | "unordered_deep";

export interface Param {
  name: string;
  type: string; // normalised: int|long|double|boolean|string|char with optional [] suffixes
}

export interface ProblemSpec {
  slug: string;
  fn: string;
  params: Param[];
  returns: string; // normalised type or "void"
  compare: Compare;
  mutates: number | null;
  examples: unknown[][];
  exampleOutputs: unknown[]; // from the statement; undefined when not parseable
  hidden: unknown[][];
  reference: string; // python3 `class Solution`
}

const BASES = new Set(["int", "long", "double", "boolean", "string", "char"]);

export function normType(t: string): string | null {
  let dims = 0;
  let s = t.trim();
  for (;;) {
    const m = s.match(/^list<(.+)>$/);
    if (m) { dims++; s = m[1]; continue; }
    if (s.endsWith("[]")) { dims++; s = s.slice(0, -2); continue; }
    break;
  }
  const base = ({ integer: "int", character: "char", long: "long", double: "double", boolean: "boolean", string: "string" } as Record<string, string>)[s];
  return base && BASES.has(base) ? base + "[]".repeat(dims) : null;
}

/** Signature-level spec, no network. null = harness can't test this problem (linked list / tree / design). */
export function baseSpec(lc: LcData): Omit<ProblemSpec, "compare" | "hidden" | "reference" | "mutates"> & { void: boolean } | null {
  const m = lc.metaData;
  if (!m || !m.params || m.classname || m.manual || m.systemdesign || !m.return) return null;
  const params: Param[] = [];
  for (const p of m.params) {
    const t = normType(p.type);
    if (!t) return null;
    params.push({ name: p.name, type: t });
  }
  const isVoid = m.return.type === "void";
  const returns = isVoid ? "void" : normType(m.return.type);
  if (!returns) return null;

  const lines = lc.exampleTestcases.split("\n").filter((l) => l.length);
  const examples: unknown[][] = [];
  for (let i = 0; i + params.length <= lines.length; i += params.length) {
    try {
      examples.push(lines.slice(i, i + params.length).map((l) => JSON.parse(l)));
    } catch {
      /* skip unparseable example */
    }
  }
  if (!examples.length) return null;
  const outs = statementOutputs(lc);
  return {
    slug: lc.slug,
    fn: m.name,
    params,
    returns,
    examples,
    exampleOutputs: outs.length === examples.length ? outs : examples.map(() => undefined),
    void: isVoid,
  };
}

/** "any order" in the statement means list answers are order-insensitive (top level). */
export function defaultCompare(lc: LcData): Compare {
  return lc.content && /any order/i.test(lc.content) ? "unordered" : "exact";
}

const CACHE = "leetgraph.extras.v1.";

const SYSTEM = `You help build a judge for a LeetCode problem. Output ONE JSON object and nothing else:
{"compare":"exact"|"unordered"|"unordered_deep","mutates":null|number,"hidden":[[...]],"reference":string}
- hidden: 10 further test inputs, each an args array with one JSON value per parameter, in order. Cover edge cases: minimum sizes, duplicates, negatives, all-equal, already-sorted/reverse-sorted, single element, plus a couple of moderately large (but under ~300 elements) cases. Every input MUST satisfy the stated constraints (including any guarantee like "exactly one solution").
- compare: "exact" unless several answers are valid: "unordered" when the returned list may be in any order, "unordered_deep" when nested lists may be in any order too.
- mutates: index of the parameter modified in place when the method returns nothing, else null.
- reference: Python 3 source of a correct, efficient "class Solution" with the SAME method name and parameter names as the given signature. Put imports at the top. If mutates is set it must modify that argument in place.`;

export async function loadSpec(lc: LcData): Promise<ProblemSpec | null> {
  const b = baseSpec(lc);
  if (!b) return null;
  let extras: { compare: string; mutates: number | null; hidden: unknown[][]; reference: string } | null = null;
  const cached = localStorage.getItem(CACHE + lc.slug);
  if (cached) {
    try {
      extras = JSON.parse(cached);
    } catch {
      localStorage.removeItem(CACHE + lc.slug);
    }
  }
  if (!extras) {
    const sig = lc.codeSnippets.python3 ?? `${b.fn}(${b.params.map((p) => p.name).join(", ")})`;
    const raw = await askJson(SYSTEM, `Title: ${lc.title}\n\nStatement:\n${statementMarkdown(lc)}\n\nPython signature:\n${sig}`, 6000);
    extras = JSON.parse(raw);
    localStorage.setItem(CACHE + lc.slug, JSON.stringify(extras));
  }
  const ex = extras!;
  const okArgs = (a: unknown) => Array.isArray(a) && a.length === b.params.length;
  return {
    slug: b.slug,
    fn: b.fn,
    params: b.params,
    returns: b.returns,
    examples: b.examples,
    exampleOutputs: b.exampleOutputs,
    compare:
      ["unordered", "unordered_deep"].includes(ex.compare) ? (ex.compare as Compare) : defaultCompare(lc),
    mutates: b.void ? (typeof ex.mutates === "number" ? ex.mutates : 0) : null,
    hidden: (ex.hidden ?? []).filter(okArgs),
    reference: String(ex.reference ?? ""),
  };
}
