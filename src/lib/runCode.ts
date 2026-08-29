// Remote code execution via Wandbox (free, CORS-open, no key needed).
// The user writes their own harness/prints — like pasting into a scratchpad.
import type { Lang } from "../components/interview/EditorPane";

const COMPILERS: Record<Lang, string> = {
  python: "cpython-3.14.0",
  javascript: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  java: "openjdk-jdk-22+36",
  cpp: "gcc-13.2.0",
  rust: "rust-1.82.0",
};

export interface RunResult {
  ok: boolean;
  output: string;
  ms: number;
}

export async function runCode(lang: Lang, code: string, stdin = ""): Promise<RunResult> {
  const t0 = performance.now();
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compiler: COMPILERS[lang], code, stdin }),
  });
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) return { ok: false, output: `Runner error: ${res.status} ${await res.text()}`, ms };
  const d = await res.json();
  const parts = [d.compiler_error, d.compiler_message, d.program_error, d.program_output]
    .filter((s: string | undefined, i: number, arr: (string | undefined)[]) => s && arr.indexOf(s) === i);
  const ok = d.status === "0" && !d.compiler_error;
  return { ok, output: parts.join("").trim() || "(no output)", ms };
}
