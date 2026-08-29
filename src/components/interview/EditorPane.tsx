import { useState } from "react";
import { motion } from "framer-motion";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import type { Extension } from "@codemirror/state";
import { FaPlus, FaXmark, FaVial, FaChevronDown, FaChevronUp, FaPlay, FaSpinner } from "react-icons/fa6";
import type { RunResult } from "../../lib/runCode";

export type Lang = "python" | "javascript" | "typescript" | "java" | "cpp" | "rust";

export interface TestCase {
  input: string;
  expected: string;
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JS" },
  { id: "typescript", label: "TS" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "rust", label: "Rust" },
];

const EXTENSIONS: Record<Lang, Extension[]> = {
  python: [python()],
  javascript: [javascript()],
  typescript: [javascript({ typescript: true })],
  java: [java()],
  cpp: [cpp()],
  rust: [rust()],
};

export const STARTER: Record<Lang, string> = {
  python: "# Write your solution here\n\ndef solve():\n    pass\n",
  javascript: "// Write your solution here\n\nfunction solve() {\n\n}\n",
  typescript: "// Write your solution here\n\nfunction solve(): void {\n\n}\n",
  java: "// Write your solution here\n\nclass Solution {\n\n}\n",
  cpp: "// Write your solution here\n\nclass Solution {\npublic:\n\n};\n",
  rust: "// Write your solution here\n\nimpl Solution {\n\n}\n",
};

export function EditorPane({
  code,
  lang,
  testCases,
  running,
  runResult,
  onChange,
  onLangChange,
  onTestCasesChange,
  onRun,
  onClearRun,
}: {
  code: string;
  lang: Lang;
  testCases: TestCase[];
  running: boolean;
  runResult: RunResult | null;
  onChange: (code: string) => void;
  onLangChange: (l: Lang) => void;
  onTestCasesChange: (t: TestCase[]) => void;
  onRun: () => void;
  onClearRun: () => void;
}) {
  const [showTests, setShowTests] = useState(true);

  const updateCase = (i: number, patch: Partial<TestCase>) =>
    onTestCasesChange(testCases.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b-4 border-black bg-neo-bg px-2 py-1.5">
        {LANGS.map((l) => (
          <motion.button
            key={l.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onLangChange(l.id)}
            className={`border-2 border-black px-2 py-0.5 text-[11px] font-black uppercase transition-colors duration-100 ${
              lang === l.id ? "bg-neo-secondary" : "bg-white text-black/50 hover:text-black"
            }`}
          >
            {l.label}
          </motion.button>
        ))}
        <motion.button
          whileHover={{ scale: 1.08, rotate: -1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onRun}
          disabled={running}
          className="ml-auto flex items-center gap-1.5 border-2 border-black bg-neo-ok px-3 py-0.5 text-[11px] font-black uppercase shadow-neo-sm disabled:opacity-60"
        >
          {running ? <FaSpinner className="animate-spin" /> : <FaPlay />}
          {running ? "Running…" : "Run"}
        </motion.button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={code}
          onChange={onChange}
          extensions={EXTENSIONS[lang]}
          height="100%"
          style={{ height: "100%" }}
          basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false }}
        />
      </div>

      {/* Run output console */}
      {runResult && (
        <div className="shrink-0 border-t-4 border-black">
          <div className={`flex items-center justify-between px-2 py-1 ${runResult.ok ? "bg-neo-ok" : "bg-neo-accent"}`}>
            <span className="text-[11px] font-black uppercase">
              {runResult.ok ? "Ran OK" : "Failed"} · {runResult.ms}ms
            </span>
            <button
              onClick={onClearRun}
              aria-label="Close output"
              className="grid h-5 w-5 place-items-center border-2 border-black bg-white text-[10px]"
            >
              <FaXmark />
            </button>
          </div>
          <pre className="max-h-36 overflow-y-auto bg-black px-3 py-2 font-mono text-[11px] font-bold leading-relaxed text-neo-ok">
            {runResult.output}
          </pre>
        </div>
      )}

      {/* Test cases — user-maintained, visible to the interviewer via snapshots */}
      <div className="shrink-0 border-t-4 border-black bg-neo-bg">
        <div className="flex items-center justify-between px-2 py-1.5">
          <button
            onClick={() => setShowTests((s) => !s)}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase"
          >
            <FaVial className="text-neo-accent" /> Test cases ({testCases.length})
            {showTests ? <FaChevronDown /> : <FaChevronUp />}
          </button>
          <button
            onClick={() => onTestCasesChange([...testCases, { input: "", expected: "" }])}
            className="flex items-center gap-1 border-2 border-black bg-neo-secondary px-2 py-0.5 text-[10px] font-black uppercase transition-transform active:translate-y-[1px]"
          >
            <FaPlus /> Add
          </button>
        </div>
        {showTests && (
          <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
            {testCases.length === 0 ? (
              <p className="pb-1 text-[10px] font-bold uppercase text-black/50">
                Add your own test cases — the interviewer sees them too.
              </p>
            ) : (
              testCases.map((t, i) => (
                <div key={i} className="flex items-stretch gap-1.5">
                  <span className="grid w-6 shrink-0 place-items-center border-2 border-black bg-white text-[10px] font-black">
                    {i + 1}
                  </span>
                  <input
                    className="min-w-0 flex-1 border-2 border-black bg-white px-1.5 py-1 font-mono text-[11px] font-bold placeholder:text-black/30 focus:bg-neo-secondary focus:outline-none"
                    placeholder="input, e.g. nums=[2,7,11,15], target=9"
                    value={t.input}
                    onChange={(e) => updateCase(i, { input: e.target.value })}
                  />
                  <input
                    className="min-w-0 flex-1 border-2 border-black bg-white px-1.5 py-1 font-mono text-[11px] font-bold placeholder:text-black/30 focus:bg-neo-secondary focus:outline-none"
                    placeholder="expected, e.g. [0,1]"
                    value={t.expected}
                    onChange={(e) => updateCase(i, { expected: e.target.value })}
                  />
                  <button
                    onClick={() => onTestCasesChange(testCases.filter((_, j) => j !== i))}
                    aria-label={`Remove test case ${i + 1}`}
                    className="grid w-6 shrink-0 place-items-center border-2 border-black bg-white text-[10px] hover:bg-neo-accent"
                  >
                    <FaXmark />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
