// Machine-checkable problem spec, built entirely from the downloaded LeetCode
// data (signature, example inputs and the outputs printed in the statement).
import { statementOutputs, type LcData } from "./lc";

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
export function baseSpec(lc: LcData): Omit<ProblemSpec, "compare" | "mutates"> & { void: boolean } | null {
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

/** Index of the argument a void method modifies in place (Rust `&mut` param, else the first one). */
function mutatedIndex(lc: LcData): number {
  const m = lc.codeSnippets.rust?.match(/pub\s+fn\s+\w+\s*\(([^)]*)\)/);
  if (!m) return 0;
  const i = m[1].split(",").findIndex((p) => p.includes("&mut"));
  return i >= 0 ? i : 0;
}

export function makeSpec(lc: LcData): ProblemSpec | null {
  const b = baseSpec(lc);
  if (!b) return null;
  return {
    slug: b.slug,
    fn: b.fn,
    params: b.params,
    returns: b.returns,
    examples: b.examples,
    exampleOutputs: b.exampleOutputs,
    compare: defaultCompare(lc),
    mutates: b.void ? mutatedIndex(lc) : null,
  };
}
