// Machine-checkable problem spec, built entirely from the downloaded LeetCode
// data (signature, example inputs and the outputs printed in the statement).
import { statementOutputs, type LcData } from "./lc";

export type Compare = "exact" | "unordered" | "unordered_deep";

export interface Param {
  name: string;
  type: string; // int|long|double|boolean|string|char|ListNode|TreeNode|Graph|Calls, optional [] suffixes
}

export interface DesignMethod {
  name: string;
  params: Param[];
  ret: string; // normalised type or "void"
}

export interface DesignSpec {
  cls: string;
  ctor: Param[];
  methods: DesignMethod[];
}

export interface ProblemSpec {
  slug: string;
  fn: string;
  params: Param[];
  returns: string; // normalised type or "void"
  compare: Compare;
  mutates: number | null;
  examples: unknown[][];
  exampleOutputs: unknown[]; // from the statement; undefined when not parseable / not checkable
  design?: DesignSpec; // class-design problem: one "calls" param = [[name, args], ...]
}

const BASES = new Set(["int", "long", "double", "boolean", "string", "char", "ListNode", "TreeNode"]);
const PLAIN = new Set(["int", "long", "double", "boolean", "string", "char"]);

export function normType(t: string): string | null {
  let dims = 0;
  let s = t.trim();
  for (;;) {
    const m = s.match(/^list<(.+)>$/);
    if (m) { dims++; s = m[1]; continue; }
    if (s.endsWith("[]")) { dims++; s = s.slice(0, -2); continue; }
    break;
  }
  const base = (
    {
      integer: "int", character: "char", long: "long", double: "double", boolean: "boolean", string: "string",
      ListNode: "ListNode", TreeNode: "TreeNode",
    } as Record<string, string>
  )[s];
  if (!base || !BASES.has(base)) return null;
  // Only ListNode[] (merge-k-lists) is supported among node arrays.
  if ((base === "TreeNode" && dims > 0) || (base === "ListNode" && dims > 1)) return null;
  return base + "[]".repeat(dims);
}

const isPlain = (t: string) => PLAIN.has(t.replace(/\[\]/g, ""));
const isNode = (t: string) => /ListNode|TreeNode|Graph/.test(t);

/** Parameter annotations of the Python method, e.g. ["Optional[ListNode]", "int"]. */
function pyParams(snippet: string | undefined, fn: string): string[] | null {
  const m = snippet?.match(new RegExp(`def\\s+${fn}\\s*\\(self,?([^\\n]*)\\)\\s*(?:->[^:]*)?:`));
  if (!m) return null;
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of m[1]) {
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.slice(p.indexOf(":") + 1));
}

// Problems whose answer isn't unique (any valid tree is accepted) — show output, don't mark right/wrong.
const NO_EXPECTED = new Set(["convert-sorted-array-to-binary-search-tree", "convert-sorted-list-to-binary-search-tree"]);
// Randomised / round-trip / interface-based designs the harness can't check.
const DESIGN_SKIP = new Set([
  "random-pick-with-weight",
  "insert-delete-getrandom-o1",
  "serialize-and-deserialize-binary-tree",
  "encode-and-decode-tinyurl",
  "peeking-iterator",
  "flatten-nested-list-iterator",
  "guess-the-word",
]);

type Base = Omit<ProblemSpec, "compare" | "mutates"> & { void: boolean };

function designBase(lc: LcData): Base | null {
  const m = lc.metaData;
  if (!m?.classname || DESIGN_SKIP.has(lc.slug) || !m.methods?.length) return null;
  const conv = (ps: { name: string; type: string }[]) => {
    const out: Param[] = [];
    for (const p of ps) {
      const t = normType(p.type);
      if (!t || !isPlain(t)) return null;
      out.push({ name: p.name, type: t });
    }
    return out;
  };
  const ctor = conv(m.constructor?.params ?? []);
  if (!ctor) return null;
  const methods: DesignMethod[] = [];
  for (const meth of m.methods) {
    const ps = conv(meth.params);
    const rt = meth.return.type === "void" ? "void" : normType(meth.return.type);
    if (!ps || !rt || (rt !== "void" && !isPlain(rt))) return null;
    methods.push({ name: meth.name, params: ps, ret: rt });
  }
  const lines = lc.exampleTestcases.split("\n").filter((l) => l.length);
  const examples: unknown[][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    try {
      const ops: string[] = JSON.parse(lines[i]);
      const args: unknown[][] = JSON.parse(lines[i + 1]);
      if (ops.length !== args.length || ops[0] !== m.classname) continue;
      examples.push([ops.map((o, k) => [o, args[k]])]);
    } catch {
      /* skip */
    }
  }
  if (!examples.length) return null;
  const outs = statementOutputs(lc);
  return {
    slug: lc.slug,
    fn: m.classname,
    params: [{ name: "calls", type: "Calls" }],
    returns: "Outputs",
    examples,
    exampleOutputs: outs.length === examples.length ? outs : examples.map(() => undefined),
    void: false,
    design: { cls: m.classname, ctor, methods },
  } as Base;
}

/** Signature-level spec, no network. null = harness can't test this problem. */
export function baseSpec(lc: LcData): Base | null {
  const m = lc.metaData;
  if (!m) return null;
  if (m.classname || m.systemdesign) return designBase(lc);
  if (!m.params || !m.return) return null;

  // clone-graph: LeetCode's metadata is wrong for it (edges/boolean); the real API is Node -> Node.
  if (lc.slug === "clone-graph") {
    const lines = lc.exampleTestcases.split("\n").filter((l) => l.length);
    const examples = lines.flatMap((l) => {
      try {
        return [[JSON.parse(l)]];
      } catch {
        return [];
      }
    });
    return {
      slug: lc.slug,
      fn: m.name,
      params: [{ name: "node", type: "Graph" }],
      returns: "Graph",
      examples,
      exampleOutputs: examples.map((e) => e[0]), // a correct deep copy has the same adjacency list
      void: false,
    };
  }

  const params: Param[] = [];
  for (const p of m.params) {
    const t = normType(p.type);
    if (!t) return null;
    params.push({ name: p.name, type: t });
  }
  const isVoid = m.return.type === "void";
  const returns = isVoid ? "void" : normType(m.return.type);
  if (!returns) return null;

  // LeetCode's metadata is unreliable for "manual" problems (node params typed as ints, extra
  // hidden params like `pos`). Trust it only when it matches the Python signature.
  const py = pyParams(lc.codeSnippets.python3, m.name);
  if (py) {
    if (py.length !== params.length) return null;
    if (py.some((a, i) => /Node/.test(a) !== isNode(params[i].type))) return null;
  }

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
  const checkable = outs.length === examples.length && !NO_EXPECTED.has(lc.slug);
  return {
    slug: lc.slug,
    fn: m.name,
    params,
    returns,
    examples,
    exampleOutputs: checkable ? outs : examples.map(() => undefined),
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
    compare: b.design ? "exact" : defaultCompare(lc),
    mutates: b.void ? mutatedIndex(lc) : null,
    design: b.design,
  };
}
