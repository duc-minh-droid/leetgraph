// LeetCode-style judge on top of Wandbox: wraps the candidate's `class
// Solution` in a per-language driver (Python, Rust) that feeds JSON test cases
// through the real method signature and reports each case's output / stdout /
// time. Cases matching a statement example are checked against its printed
// output; custom cases just display what the code produced.
import type { Lang, LcData } from "./lc";
import { starterCode } from "./lc";
import type { ProblemSpec } from "./spec";

const COMPILERS: Record<Lang, string> = { python: "cpython-3.14.0", rust: "rust-1.82.0" };

export type Verdict =
  | "Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Compile Error";

export interface CaseResult {
  status: "pass" | "fail" | "error" | "tle" | "ran";
  args: string[]; // JSON text per parameter
  output?: string;
  expected?: string;
  stdout?: string;
  error?: string;
  ms: number;
}

export interface JudgeResult {
  verdict: Verdict;
  message?: string; // compile / fatal error text
  cases: CaseResult[];
  passed: number;
  total: number;
  ms: number;
  failedIndex: number | null; // index into cases
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const TIMEOUT_S = 3;

// ---------------- drivers ----------------

function pythonProgram(code: string, fn: string, mut: number | null, cases: unknown[][]): string {
  const data = b64(JSON.stringify({ fn, mut, cases, timeout: TIMEOUT_S }));
  return `from typing import *
import collections, heapq, bisect, math, itertools, functools, sys, json, time, io, copy, contextlib, traceback, signal, base64
from collections import deque, defaultdict, Counter, OrderedDict
from heapq import heappush, heappop, heapify, heappushpop
from functools import lru_cache, cache
from bisect import bisect_left, bisect_right
sys.setrecursionlimit(10000)

${code}

def __lg_main():
    T = json.loads(base64.b64decode("${data}").decode())
    out = []
    class TO(BaseException):
        pass
    def handler(s, f):
        raise TO()
    signal.signal(signal.SIGALRM, handler)
    for args in T["cases"]:
        buf = io.StringIO()
        r = {}
        t0 = time.perf_counter()
        try:
            a = copy.deepcopy(args)
            sol = Solution()
            signal.setitimer(signal.ITIMER_REAL, T["timeout"])
            with contextlib.redirect_stdout(buf):
                o = getattr(sol, T["fn"])(*a)
            signal.setitimer(signal.ITIMER_REAL, 0)
            if T["mut"] is not None:
                o = a[T["mut"]]
            r["out"] = json.dumps(o)
        except TO:
            r["tle"] = True
        except BaseException:
            signal.setitimer(signal.ITIMER_REAL, 0)
            tb = traceback.format_exc().strip().splitlines()
            r["err"] = "\\n".join(tb[-4:])
        r["ms"] = (time.perf_counter() - t0) * 1000
        r["stdout"] = buf.getvalue()[:4000]
        out.append(r)
    sys.stdout.write("\\n@@LG@@" + json.dumps(out))

__lg_main()
`;
}

interface RustSig {
  fn: string;
  params: { ty: string; ref: "" | "&" | "&mut " }[];
  ret: string | null;
}

function parseRustSig(snippet: string): RustSig | null {
  const m = snippet.match(/pub\s+fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^{]+?))?\s*\{/);
  if (!m) return null;
  const params: RustSig["params"] = [];
  let depth = 0;
  let cur = "";
  const parts: string[] = [];
  for (const ch of m[2]) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const ty = p.slice(p.indexOf(":") + 1).trim();
    const ref = ty.startsWith("&mut ") ? "&mut " : ty.startsWith("&") ? "&" : "";
    params.push({ ty: ty.replace(/^&(mut\s+)?/, "").trim(), ref });
  }
  return { fn: m[1], params, ret: m[3]?.trim() ?? null };
}

const RUST_RUNTIME = String.raw`
#[derive(Clone, Debug)]
enum J { Null, Bool(bool), Num(String), Str(String), Arr(Vec<J>) }
struct Pr { s: Vec<char>, i: usize }
impl Pr {
    fn ws(&mut self) { while self.i < self.s.len() && self.s[self.i].is_whitespace() { self.i += 1; } }
    fn val(&mut self) -> J {
        self.ws();
        match self.s[self.i] {
            '[' => {
                self.i += 1;
                let mut v = vec![];
                loop {
                    self.ws();
                    if self.s[self.i] == ']' { self.i += 1; break; }
                    v.push(self.val());
                    self.ws();
                    if self.s[self.i] == ',' { self.i += 1; }
                }
                J::Arr(v)
            }
            '"' => {
                self.i += 1;
                let mut o = String::new();
                loop {
                    let c = self.s[self.i];
                    self.i += 1;
                    if c == '"' { break; }
                    if c == '\\' {
                        let e = self.s[self.i];
                        self.i += 1;
                        match e {
                            'n' => o.push('\n'),
                            't' => o.push('\t'),
                            'r' => o.push('\r'),
                            'u' => {
                                let h: String = self.s[self.i..self.i + 4].iter().collect();
                                self.i += 4;
                                o.push(char::from_u32(u32::from_str_radix(&h, 16).unwrap_or(63)).unwrap_or('?'));
                            }
                            x => o.push(x),
                        }
                    } else { o.push(c); }
                }
                J::Str(o)
            }
            't' => { self.i += 4; J::Bool(true) }
            'f' => { self.i += 5; J::Bool(false) }
            'n' => { self.i += 4; J::Null }
            _ => {
                let st = self.i;
                while self.i < self.s.len() && "+-.eE0123456789".contains(self.s[self.i]) { self.i += 1; }
                J::Num(self.s[st..self.i].iter().collect())
            }
        }
    }
}
trait FromJ: Sized { fn from_j(j: &J) -> Self; }
impl FromJ for i32 { fn from_j(j: &J) -> Self { if let J::Num(s) = j { s.parse::<i64>().unwrap_or(0) as i32 } else { 0 } } }
impl FromJ for i64 { fn from_j(j: &J) -> Self { if let J::Num(s) = j { s.parse::<i64>().unwrap_or(0) } else { 0 } } }
impl FromJ for f64 { fn from_j(j: &J) -> Self { if let J::Num(s) = j { s.parse::<f64>().unwrap_or(0.0) } else { 0.0 } } }
impl FromJ for bool { fn from_j(j: &J) -> Self { matches!(j, J::Bool(true)) } }
impl FromJ for String { fn from_j(j: &J) -> Self { if let J::Str(s) = j { s.clone() } else { String::new() } } }
impl FromJ for char { fn from_j(j: &J) -> Self { if let J::Str(s) = j { s.chars().next().unwrap_or(' ') } else { ' ' } } }
impl<T: FromJ> FromJ for Vec<T> { fn from_j(j: &J) -> Self { if let J::Arr(v) = j { v.iter().map(T::from_j).collect() } else { vec![] } } }
fn esc(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 32 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}
trait ToJ { fn to_j(&self) -> String; }
impl ToJ for i32 { fn to_j(&self) -> String { self.to_string() } }
impl ToJ for i64 { fn to_j(&self) -> String { self.to_string() } }
impl ToJ for f64 { fn to_j(&self) -> String { if self.is_finite() { format!("{:?}", self) } else { "null".to_string() } } }
impl ToJ for bool { fn to_j(&self) -> String { self.to_string() } }
impl ToJ for String { fn to_j(&self) -> String { esc(self) } }
impl ToJ for char { fn to_j(&self) -> String { esc(&self.to_string()) } }
impl<T: ToJ> ToJ for Vec<T> { fn to_j(&self) -> String { format!("[{}]", self.iter().map(|x| x.to_j()).collect::<Vec<_>>().join(",")) } }
fn panic_msg(e: Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = e.downcast_ref::<&str>() { s.to_string() }
    else if let Some(s) = e.downcast_ref::<String>() { s.clone() }
    else { "panicked".to_string() }
}
`;

function rustProgram(code: string, sig: RustSig, mut: number | null, cases: unknown[][]): string {
  const lets = sig.params
    .map((p, i) => `let mut p${i}: ${p.ty} = FromJ::from_j(&a[${i}]);`)
    .join("\n                ");
  const callArgs = sig.params.map((p, i) => `${p.ref}p${i}`).join(", ");
  const tail = mut != null && !sig.ret ? `ToJ::to_j(&p${mut})` : `ToJ::to_j(&r)`;
  const call = sig.ret ? `let r = Solution::${sig.fn}(${callArgs});` : `Solution::${sig.fn}(${callArgs}); let r = ();`;
  const data = JSON.stringify(cases);
  return `#![allow(unused, dead_code, unused_mut)]
use std::collections::*;
use std::rc::Rc;
use std::cell::RefCell;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};
use std::panic::AssertUnwindSafe;
struct Solution;
${code}
${RUST_RUNTIME}
fn main() {
    let data = r####"${data}"####;
    let cases = Pr { s: data.chars().collect(), i: 0 }.val();
    std::panic::set_hook(Box::new(|_| {}));
    let mut res: Vec<String> = vec![];
    let mut timed_out = false;
    if let J::Arr(cs) = cases {
        for c in cs {
            println!("\\n@@LGC@@");
            let (tx, rx) = mpsc::channel();
            let t0 = Instant::now();
            thread::Builder::new().stack_size(128 * 1024 * 1024).spawn(move || {
                let r = std::panic::catch_unwind(AssertUnwindSafe(|| {
                    let a = match &c { J::Arr(a) => a.clone(), _ => vec![] };
                    ${lets}
                    ${call}
                    ${tail}
                }));
                let _ = tx.send(r.map_err(panic_msg));
            }).unwrap();
            match rx.recv_timeout(Duration::from_secs(${TIMEOUT_S})) {
                Ok(Ok(s)) => res.push(format!("{{\\"out\\":{},\\"ms\\":{:.3}}}", esc(&s), t0.elapsed().as_secs_f64() * 1000.0)),
                Ok(Err(m)) => res.push(format!("{{\\"err\\":{},\\"ms\\":{:.3}}}", esc(&m), t0.elapsed().as_secs_f64() * 1000.0)),
                Err(_) => { res.push("{\\"tle\\":true,\\"ms\\":3000}".to_string()); timed_out = true; break; }
            }
        }
    }
    println!("\\n@@LG@@[{}]", res.join(","));
    if timed_out { std::process::exit(0); }
}
`;
}

// ---------------- execution ----------------

interface RawCase {
  out?: string;
  err?: string;
  tle?: boolean;
  ms: number;
  stdout?: string;
}

type Exec = { kind: "ok"; cases: RawCase[] } | { kind: "ce"; message: string } | { kind: "fatal"; message: string; tle: boolean };

async function wandbox(lang: Lang, code: string): Promise<Record<string, string>> {
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compiler: COMPILERS[lang], code }),
  });
  if (!res.ok) throw new Error(`Runner error ${res.status}`);
  return res.json();
}

async function execCases(lang: Lang, program: string, n: number): Promise<Exec> {
  const d = await wandbox(lang, program);
  const out = d.program_output ?? "";
  const i = out.lastIndexOf("\n@@LG@@");
  if (i >= 0) {
    try {
      const cases: RawCase[] = JSON.parse(out.slice(i + 7));
      if (lang === "rust") {
        const segs = out.slice(0, i).split("\n@@LGC@@\n").slice(1);
        cases.forEach((c, k) => (c.stdout = (segs[k] ?? "").replace(/\n$/, "")));
      }
      return { kind: "ok", cases };
    } catch {
      /* fallthrough */
    }
  }
  const perr0 = (d.program_error ?? "").trim();
  if (lang === "python" && /(^|\n)\s*(SyntaxError|IndentationError|TabError)/.test(perr0)) {
    return { kind: "ce", message: cleanCompile(perr0, lang) };
  }
  const cerr = (d.compiler_error ?? "").trim();
  if (cerr && d.status !== "0") return { kind: "ce", message: cleanCompile(cerr, lang) };
  const perr = (d.program_error ?? "").trim();
  const tle = Boolean(d.signal) || /killed|timed out|time limit/i.test(perr + (d.status ?? ""));
  void n;
  return { kind: "fatal", tle, message: perr || out.slice(0, 1500) || "Program produced no result." };
}

// Hide our driver's line numbers: only keep the errors that point at user code.
function cleanCompile(msg: string, lang: Lang): string {
  if (lang === "python") return msg.replace(/File "[^"]*prog\.py", /g, "").split("\n").slice(-6).join("\n");
  return msg.split("\n").slice(0, 40).join("\n");
}

// ---------------- compare ----------------

function canon(v: unknown, deep: boolean): unknown {
  if (!Array.isArray(v)) return v;
  const items = v.map((x) => (deep ? canon(x, true) : x));
  return deep ? items.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : items;
}

function deepEq(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  return a === b;
}

function same(spec: ProblemSpec, out: string, exp: string): boolean {
  let a: unknown, b: unknown;
  try {
    a = JSON.parse(out);
    b = JSON.parse(exp);
  } catch {
    return out === exp;
  }
  if (spec.compare !== "exact" && Array.isArray(a) && Array.isArray(b)) {
    const deep = spec.compare === "unordered_deep";
    const key = (x: unknown) => JSON.stringify(canon(x, deep));
    a = [...a].sort((p, q) => (key(p) < key(q) ? -1 : 1));
    b = [...b].sort((p, q) => (key(p) < key(q) ? -1 : 1));
    if (deep) {
      a = (a as unknown[]).map((x) => canon(x, true));
      b = (b as unknown[]).map((x) => canon(x, true));
    }
  }
  return deepEq(a, b);
}

// ---------------- expected outputs (statement examples only) ----------------

const key = (args: unknown[]) => JSON.stringify(args);

/** Expected output (JSON text) for a case that matches a statement example; undefined for custom cases. */
function expectedFor(spec: ProblemSpec, cases: unknown[][]): (string | undefined)[] {
  return cases.map((a) => {
    const i = spec.examples.findIndex((e) => key(e) === key(a));
    const o = i >= 0 ? spec.exampleOutputs[i] : undefined;
    return o === undefined ? undefined : JSON.stringify(o);
  });
}

// ---------------- public API ----------------

function compact(j: string): string {
  try {
    return JSON.stringify(JSON.parse(j));
  } catch {
    return j;
  }
}

function argText(a: unknown[]): string[] {
  return a.map((x) => JSON.stringify(x));
}

function summarize(
  results: CaseResult[],
  total: number
): JudgeResult {
  const bad = results.findIndex((c) => c.status === "fail" || c.status === "error" || c.status === "tle");
  const passed = results.filter((c) => c.status === "pass" || c.status === "ran").length;
  const first = bad >= 0 ? results[bad] : null;
  const verdict: Verdict = !first
    ? "Accepted"
    : first.status === "fail"
      ? "Wrong Answer"
      : first.status === "tle"
        ? "Time Limit Exceeded"
        : "Runtime Error";
  return {
    verdict,
    cases: results,
    passed,
    total,
    ms: Math.round(results.reduce((s, c) => s + c.ms, 0)),
    failedIndex: bad >= 0 ? bad : null,
  };
}

function fail(v: Verdict, message: string, total: number): JudgeResult {
  return { verdict: v, message, cases: [], passed: 0, total, ms: 0, failedIndex: null };
}

export function judgeSupported(lang: Lang, lc: LcData | null): boolean {
  return Boolean(lc?.codeSnippets && (lang === "python" || parseRustSig(lc.codeSnippets.rust ?? "")));
}

function buildProgram(spec: ProblemSpec, lc: LcData, lang: Lang, code: string, cases: unknown[][]): string | null {
  if (lang === "python") return pythonProgram(code, spec.fn, spec.mutates, cases);
  const sig = parseRustSig(lc.codeSnippets.rust ?? "");
  return sig ? rustProgram(code, sig, spec.mutates, cases) : null;
}

async function runUser(spec: ProblemSpec, lc: LcData, lang: Lang, code: string, cases: unknown[][]): Promise<Exec> {
  const program = buildProgram(spec, lc, lang, code, cases);
  if (!program) return { kind: "fatal", message: "This problem's Rust signature can't be harnessed yet — switch to Python.", tle: false };
  return execCases(lang, program, cases.length);
}

function toResults(spec: ProblemSpec, cases: unknown[][], raw: RawCase[], exp: (string | undefined)[]): CaseResult[] {
  return cases.map((a, i) => {
    const r = raw[i];
    const args = argText(a);
    if (!r) return { status: "ran", args, ms: 0, error: "Not executed (an earlier case stopped the run)." };
    if (r.tle) return { status: "tle", args, ms: r.ms, stdout: r.stdout, expected: exp[i] };
    if (r.err) return { status: "error", args, ms: r.ms, stdout: r.stdout, error: r.err, expected: exp[i] };
    const output = compact(r.out ?? "null");
    const e = exp[i] === undefined ? undefined : compact(exp[i]!);
    const status = e === undefined ? "ran" : same(spec, output, e) ? "pass" : "fail";
    return { status, args, output, expected: e, stdout: r.stdout, ms: r.ms };
  });
}

/** Run the candidate's cases. Examples are checked against the statement; custom cases just show their output. */
export async function runTests(spec: ProblemSpec, lc: LcData, lang: Lang, code: string, cases: unknown[][]): Promise<JudgeResult> {
  const exec = await runUser(spec, lc, lang, code, cases);
  if (exec.kind === "ce") return fail("Compile Error", exec.message, cases.length);
  if (exec.kind === "fatal") return fail(exec.tle ? "Time Limit Exceeded" : "Runtime Error", exec.message, cases.length);
  return summarize(toResults(spec, cases, exec.cases, expectedFor(spec, cases)), cases.length);
}

export function initialCases(spec: ProblemSpec): string[][] {
  return spec.examples.map(argText);
}

export function parseCaseArgs(spec: ProblemSpec, text: string[]): { ok: true; args: unknown[] } | { ok: false; error: string } {
  const args: unknown[] = [];
  for (let i = 0; i < spec.params.length; i++) {
    try {
      args.push(JSON.parse(text[i] ?? ""));
    } catch {
      return { ok: false, error: `${spec.params[i].name}: not valid JSON (strings need "quotes")` };
    }
  }
  return { ok: true, args };
}

export { starterCode };
