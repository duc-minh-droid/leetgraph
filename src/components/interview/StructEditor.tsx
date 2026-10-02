// Visual editors for non-array inputs: linked lists, binary trees, graphs, and
// class-design call sequences. Each one reads / writes the same JSON text the
// judge already consumes (LeetCode's own formats), so the JSON view stays in sync.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FaPlus, FaXmark, FaArrowRight, FaArrowUp, FaArrowDown } from "react-icons/fa6";
import { sfx } from "../../lib/sfx";
import type { DesignSpec } from "../../lib/spec";

export const VISUAL_TYPES = new Set(["ListNode", "ListNode[]", "TreeNode", "Graph"]);

const btn =
  "grid place-items-center border-2 border-black bg-white text-[10px] font-black uppercase hover:bg-neo-secondary disabled:opacity-40 disabled:hover:bg-white";

function tryParse(s: string): { ok: true; v: unknown } | { ok: false } {
  try {
    return { ok: true, v: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase text-black/45">{children}</p>;
}

// ---------------------------------------------------------------- linked list

function ListEditor({ values, onChange }: { values: number[]; onChange: (v: number[]) => void }) {
  const set = (i: number, v: number) => onChange(values.map((x, j) => (j === i ? v : x)));
  const insert = (at: number) => {
    sfx("popOpen", 0.35);
    onChange([...values.slice(0, at), (values[at - 1] ?? 0) + 1, ...values.slice(at)]);
  };
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      <span className="mr-1 border-2 border-black bg-black px-1.5 py-0.5 text-[10px] font-black uppercase text-neo-secondary">head</span>
      {values.map((v, i) => (
        <div key={i} className="flex items-center">
          <FaArrowRight className="mx-1 text-[10px] text-black/50" />
          <div className="group/n relative">
            <input
              type="number"
              value={v}
              onChange={(e) => set(i, e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
              className="h-9 w-14 border-2 border-black bg-white text-center font-mono text-[13px] font-black focus:bg-neo-secondary/50 focus:outline-none"
            />
            <button
              onClick={() => {
                sfx("trash", 0.35);
                onChange(values.filter((_, j) => j !== i));
              }}
              aria-label={`Delete node ${i + 1}`}
              className={`${btn} absolute -right-2 -top-2 hidden h-4 w-4 group-hover/n:grid`}
            >
              <FaXmark />
            </button>
            <button
              onClick={() => insert(i + 1)}
              aria-label={`Insert after node ${i + 1}`}
              className={`${btn} absolute -bottom-2 left-1/2 hidden h-4 w-4 -translate-x-1/2 group-hover/n:grid`}
            >
              <FaPlus />
            </button>
          </div>
        </div>
      ))}
      <FaArrowRight className="mx-1 text-[10px] text-black/50" />
      <span className="border-2 border-dashed border-black/50 px-1.5 py-1 text-[10px] font-black uppercase text-black/50">null</span>
      <button onClick={() => insert(values.length)} className={`${btn} ml-2 h-7 gap-1 px-2`}>
        <span className="flex items-center gap-1">
          <FaPlus /> Node
        </span>
      </button>
    </div>
  );
}

function ListsEditor({ lists, onChange }: { lists: number[][]; onChange: (v: number[][]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {lists.map((l, i) => (
        <div key={i} className="flex items-start gap-2 border-2 border-black bg-white p-2">
          <span className="mt-1 text-[10px] font-black uppercase text-black/50">#{i + 1}</span>
          <div className="min-w-0 flex-1">
            <ListEditor values={l} onChange={(v) => onChange(lists.map((x, j) => (j === i ? v : x)))} />
          </div>
          <button onClick={() => onChange(lists.filter((_, j) => j !== i))} aria-label={`Remove list ${i + 1}`} className={`${btn} h-5 w-5`}>
            <FaXmark />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...lists, [1]])} className={`${btn} h-7 w-fit gap-1 px-2`}>
        <span className="flex items-center gap-1">
          <FaPlus /> List
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- binary tree

interface T {
  v: number;
  l: T | null;
  r: T | null;
}

function parseTree(a: unknown[]): T | null {
  if (!a.length || a[0] === null) return null;
  const root: T = { v: num(a[0]), l: null, r: null };
  const q = [root];
  let i = 1;
  while (q.length && i < a.length) {
    const n = q.shift()!;
    if (a[i] !== null && a[i] !== undefined) {
      n.l = { v: num(a[i]), l: null, r: null };
      q.push(n.l);
    }
    i++;
    if (i < a.length) {
      if (a[i] !== null && a[i] !== undefined) {
        n.r = { v: num(a[i]), l: null, r: null };
        q.push(n.r);
      }
      i++;
    }
  }
  return root;
}

function serializeTree(t: T | null): (number | null)[] {
  if (!t) return [];
  const out: (number | null)[] = [];
  const q: (T | null)[] = [t];
  while (q.length) {
    const n = q.shift()!;
    if (!n) out.push(null);
    else {
      out.push(n.v);
      q.push(n.l, n.r);
    }
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

function mapAt(t: T | null, path: string, f: (n: T | null) => T | null): T | null {
  if (!path) return f(t);
  if (!t) return t;
  const [h, ...rest] = path;
  const p = rest.join("");
  return h === "L" ? { ...t, l: mapAt(t.l, p, f) } : { ...t, r: mapAt(t.r, p, f) };
}
function getAt(t: T | null, path: string): T | null {
  let n = t;
  for (const c of path) {
    if (!n) return null;
    n = c === "L" ? n.l : n.r;
  }
  return n;
}
const maxVal = (t: T | null): number => (t ? Math.max(t.v, maxVal(t.l), maxVal(t.r)) : 0);

interface Pos {
  path: string;
  x: number;
  y: number;
  v: number;
  parent?: { x: number; y: number };
}

function layout(t: T | null): { nodes: Pos[]; w: number; h: number } {
  const nodes: Pos[] = [];
  let col = 0;
  let depthMax = 0;
  const walk = (n: T | null, path: string, d: number, parent?: { x: number; y: number }) => {
    if (!n) return;
    const idx = nodes.length;
    nodes.push({ path, x: 0, y: 30 + d * 54, v: n.v, parent });
    depthMax = Math.max(depthMax, d);
    // x is assigned in-order so subtrees never overlap
    walk(n.l, path + "L", d + 1, undefined);
    const x = 28 + col++ * 44;
    nodes[idx].x = x;
    walk(n.r, path + "R", d + 1, undefined);
  };
  walk(t, "", 0);
  const byPath = new Map(nodes.map((n) => [n.path, n]));
  for (const n of nodes) if (n.path) n.parent = byPath.get(n.path.slice(0, -1));
  return { nodes, w: Math.max(120, 28 + col * 44), h: 56 + depthMax * 54 };
}

function TreeEditor({ values, onChange }: { values: unknown[]; onChange: (v: unknown[]) => void }) {
  const tree = useMemo(() => parseTree(values), [values]);
  const [sel, setSel] = useState("");
  const { nodes, w, h } = useMemo(() => layout(tree), [tree]);
  const cur = getAt(tree, sel);
  useEffect(() => {
    if (tree && !getAt(tree, sel)) setSel("");
  }, [tree, sel]);
  const commit = (t: T | null) => onChange(serializeTree(t));
  const addChild = (side: "L" | "R") => {
    sfx("popOpen", 0.35);
    const child: T = { v: maxVal(tree) + 1, l: null, r: null };
    commit(mapAt(tree, sel, (n) => (n ? { ...n, [side === "L" ? "l" : "r"]: child } : n)));
    setSel(sel + side);
  };

  if (!tree) {
    return (
      <div className="flex items-center gap-2">
        <Hint>Empty tree</Hint>
        <button
          onClick={() => {
            sfx("popOpen", 0.35);
            commit({ v: 1, l: null, r: null });
            setSel("");
          }}
          className={`${btn} h-7 gap-1 px-2`}
        >
          <span className="flex items-center gap-1">
            <FaPlus /> Root
          </span>
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-full overflow-auto border-2 border-black bg-white">
        <svg width={w} height={h} className="block">
          {nodes.map(
            (n) => n.parent && <line key={"e" + n.path} x1={n.parent.x} y1={n.parent.y} x2={n.x} y2={n.y} stroke="#000" strokeWidth={2} />
          )}
          {nodes.map((n) => (
            <g key={n.path} onClick={() => setSel(n.path)} className="cursor-pointer">
              <circle cx={n.x} cy={n.y} r={17} fill={sel === n.path ? "#FFD93D" : "#fff"} stroke="#000" strokeWidth={3} />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={12} fontWeight={900} fontFamily="monospace">
                {n.v}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {cur && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase text-black/50">Node</span>
          <input
            type="number"
            value={cur.v}
            onChange={(e) => commit(mapAt(tree, sel, (n) => (n ? { ...n, v: e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)) } : n)))}
            className="h-7 w-16 border-2 border-black bg-white text-center font-mono text-[12px] font-black focus:bg-neo-secondary/50 focus:outline-none"
          />
          <button disabled={Boolean(cur.l)} onClick={() => addChild("L")} className={`${btn} h-7 gap-1 px-2`}>
            <span className="flex items-center gap-1">
              <FaPlus /> Left
            </span>
          </button>
          <button disabled={Boolean(cur.r)} onClick={() => addChild("R")} className={`${btn} h-7 gap-1 px-2`}>
            <span className="flex items-center gap-1">
              <FaPlus /> Right
            </span>
          </button>
          <button
            onClick={() => {
              sfx("trash", 0.35);
              commit(mapAt(tree, sel, () => null));
              setSel(sel.slice(0, -1));
            }}
            className={`${btn} h-7 gap-1 px-2 hover:!bg-neo-accent`}
          >
            <span className="flex items-center gap-1">
              <FaXmark /> {sel ? "Subtree" : "Tree"}
            </span>
          </button>
        </div>
      )}
      <Hint>Click a node to edit it or add children.</Hint>
    </div>
  );
}

// ---------------------------------------------------------------- graph

function GraphEditor({ adj, onChange }: { adj: number[][]; onChange: (v: number[][]) => void }) {
  const n = adj.length;
  const [sel, setSel] = useState<number | null>(null);
  const R = Math.max(70, 18 * n);
  const size = R * 2 + 70;
  const pos = (i: number) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: size / 2 + (n === 1 ? 0 : R * Math.cos(a)), y: size / 2 + (n === 1 ? 0 : R * Math.sin(a)) };
  };
  const toggle = (a: number, b: number) => {
    const has = adj[a].includes(b + 1);
    sfx(has ? "deselect" : "select", 0.35);
    onChange(
      adj.map((ns, i) => {
        if (i === a) return has ? ns.filter((x) => x !== b + 1) : [...ns, b + 1].sort((x, y) => x - y);
        if (i === b) return has ? ns.filter((x) => x !== a + 1) : [...ns, a + 1].sort((x, y) => x - y);
        return ns;
      })
    );
  };
  const edges: [number, number][] = [];
  adj.forEach((ns, i) => ns.forEach((j) => j - 1 > i && edges.push([i, j - 1])));

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-full overflow-auto border-2 border-black bg-white">
        <svg width={size} height={size} className="mx-auto block">
          {edges.map(([a, b]) => {
            const p = pos(a);
            const q = pos(b);
            return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#000" strokeWidth={2.5} />;
          })}
          {adj.map((_, i) => {
            const p = pos(i);
            return (
              <g
                key={i}
                className="cursor-pointer"
                onClick={() => {
                  if (sel === null) setSel(i);
                  else if (sel === i) setSel(null);
                  else toggle(sel, i);
                }}
              >
                <circle cx={p.x} cy={p.y} r={18} fill={sel === i ? "#FFD93D" : "#fff"} stroke="#000" strokeWidth={3} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={12} fontWeight={900} fontFamily="monospace">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => {
            sfx("popOpen", 0.35);
            onChange([...adj, []]);
          }}
          className={`${btn} h-7 gap-1 px-2`}
        >
          <span className="flex items-center gap-1">
            <FaPlus /> Node
          </span>
        </button>
        <button
          disabled={n === 0}
          onClick={() => {
            sfx("trash", 0.35);
            setSel(null);
            onChange(adj.slice(0, -1).map((ns) => ns.filter((x) => x !== n)));
          }}
          className={`${btn} h-7 gap-1 px-2 hover:!bg-neo-accent`}
        >
          <span className="flex items-center gap-1">
            <FaXmark /> Last node
          </span>
        </button>
        <Hint>Click a node, then another to connect / disconnect them.</Hint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- entry point

export function StructEditor({ type, value, onChange }: { type: string; value: string; onChange: (v: string) => void }) {
  const p = tryParse(value);
  if (!p.ok) return <Hint>Invalid JSON — fix it in the JSON view.</Hint>;
  const v = p.v;
  const emit = (x: unknown) => onChange(JSON.stringify(x));
  if (type === "ListNode" && Array.isArray(v)) return <ListEditor values={v.map(num)} onChange={emit} />;
  if (type === "ListNode[]" && Array.isArray(v))
    return <ListsEditor lists={v.map((l) => (Array.isArray(l) ? l.map(num) : []))} onChange={emit} />;
  if (type === "TreeNode" && Array.isArray(v)) return <TreeEditor values={v} onChange={emit} />;
  if (type === "Graph" && Array.isArray(v))
    return <GraphEditor adj={v.map((ns) => (Array.isArray(ns) ? ns.map(num) : []))} onChange={emit} />;
  return <Hint>Unsupported value — use the JSON view.</Hint>;
}

// ---------------------------------------------------------------- class design

type Call = [string, unknown[]];

function ArgInput({ type, value, onChange, label }: { type: string; value: unknown; onChange: (v: unknown) => void; label: string }) {
  const isStr = type === "string" || type === "char";
  const shown = isStr ? String(value ?? "") : JSON.stringify(value ?? null);
  const [draft, setDraft] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(shown);
    setBad(false);
  }, [shown]);
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black uppercase text-black/45">{label}</span>
      <input
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          if (isStr) return onChange(e.target.value);
          const r = tryParse(e.target.value);
          setBad(!r.ok);
          if (r.ok) onChange(r.v);
        }}
        className={`h-7 w-24 border-2 border-black bg-white px-1.5 font-mono text-[12px] font-bold focus:bg-neo-secondary/50 focus:outline-none ${
          bad ? "!border-neo-accent" : ""
        }`}
      />
    </label>
  );
}

const callText = (c: Call) => `${c[0]}(${c[1].map((a) => JSON.stringify(a)).join(", ")})`;

export function DesignEditor({ design, value, onChange }: { design: DesignSpec; value: string; onChange: (v: string) => void }) {
  const p = tryParse(value);
  if (!p.ok || !Array.isArray(p.v)) return <Hint>Invalid JSON — fix it in the JSON view.</Hint>;
  const calls = p.v as Call[];
  const emit = (c: Call[]) => onChange(JSON.stringify(c));
  const setArg = (i: number, k: number, v: unknown) =>
    emit(calls.map((c, j) => (j === i ? ([c[0], c[1].map((a, m) => (m === k ? v : a))] as Call) : c)));
  const dflt = (t: string) => (t === "string" || t === "char" ? "" : t.endsWith("[]") ? [] : t === "boolean" ? false : 0);
  const add = (name: string) => {
    const m = design.methods.find((x) => x.name === name);
    if (!m) return;
    sfx("popOpen", 0.35);
    emit([...calls, [name, m.params.map((q) => dflt(q.type))]]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 1 || j >= calls.length) return;
    const next = [...calls];
    [next[i], next[j]] = [next[j], next[i]];
    emit(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {calls.map((c, i) => {
        const params = i === 0 ? design.ctor : (design.methods.find((m) => m.name === c[0])?.params ?? []);
        return (
          <div key={i} className="flex flex-wrap items-end gap-2 border-2 border-black bg-white p-1.5">
            <span className="grid h-7 w-6 place-items-center border-2 border-black bg-neo-bg text-[10px] font-black">{i + 1}</span>
            <span className={`flex h-7 items-center border-2 border-black px-2 text-[11px] font-black ${i === 0 ? "bg-black text-neo-secondary" : "bg-neo-secondary"}`}>
              {i === 0 ? `new ${design.cls}` : c[0]}
            </span>
            {params.map((q, k) => (
              <ArgInput key={q.name} label={q.name} type={q.type} value={c[1][k]} onChange={(v) => setArg(i, k, v)} />
            ))}
            {i > 0 && (
              <div className="ml-auto flex gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 1} aria-label="Move up" className={`${btn} h-7 w-6`}>
                  <FaArrowUp />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === calls.length - 1} aria-label="Move down" className={`${btn} h-7 w-6`}>
                  <FaArrowDown />
                </button>
                <button
                  onClick={() => {
                    sfx("trash", 0.35);
                    emit(calls.filter((_, j) => j !== i));
                  }}
                  aria-label="Delete call"
                  className={`${btn} h-7 w-6 hover:!bg-neo-accent`}
                >
                  <FaXmark />
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black uppercase text-black/50">Add call</span>
        {design.methods.map((m) => (
          <button key={m.name} onClick={() => add(m.name)} className={`${btn} h-7 px-2 normal-case`}>
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Step-by-step trace of a design run: call, returned value, expected value. */
export function DesignTrace({ calls, output, expected }: { calls: string; output?: string; expected?: string }) {
  const c = tryParse(calls);
  if (!c.ok || !Array.isArray(c.v)) return null;
  const outs = output ? tryParse(output) : null;
  const exps = expected ? tryParse(expected) : null;
  const o = outs && outs.ok && Array.isArray(outs.v) ? (outs.v as unknown[]) : [];
  const e = exps && exps.ok && Array.isArray(exps.v) ? (exps.v as unknown[]) : null;
  const show = (x: unknown) => (x === undefined ? "—" : x === null ? "null" : JSON.stringify(x));
  return (
    <div className="overflow-x-auto border-2 border-black bg-white">
      <table className="w-full text-left font-mono text-[11px] font-bold">
        <thead>
          <tr className="border-b-2 border-black bg-neo-secondary text-[10px] font-black uppercase">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Call</th>
            <th className="px-2 py-1">Returned</th>
            {e && <th className="px-2 py-1">Expected</th>}
          </tr>
        </thead>
        <tbody>
          {(c.v as Call[]).map((call, i) => {
            const got = o[i];
            const want = e ? e[i] : undefined;
            const ran = i < o.length;
            const wrong = e && ran && JSON.stringify(got) !== JSON.stringify(want) && !(typeof got === "number" && typeof want === "number" && Math.abs(got - want) < 1e-5);
            return (
              <tr key={i} className={`border-b border-black/20 ${wrong ? "bg-[#fee2e2]" : ran && e ? "bg-[#dcfce7]/60" : ""}`}>
                <td className="px-2 py-1 text-black/50">{i + 1}</td>
                <td className="px-2 py-1">{i === 0 ? `new ${call[0]}(${call[1].map((a) => JSON.stringify(a)).join(", ")})` : callText(call)}</td>
                <td className="px-2 py-1">{ran ? show(got) : "—"}</td>
                {e && <td className="px-2 py-1">{show(want)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
