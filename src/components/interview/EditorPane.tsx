import { useState } from "react";
import { motion } from "framer-motion";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightActiveLine, highlightActiveLineGutter, lineNumbers, rectangularSelection, dropCursor } from "@codemirror/view";
import { history, historyKeymap, defaultKeymap, indentWithTab, insertNewlineAndIndent, toggleComment } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, acceptCompletion, completionStatus } from "@codemirror/autocomplete";
import { bracketMatching, indentOnInput, indentUnit, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { githubLight } from "@uiw/codemirror-theme-github";
import { sfx } from "../../lib/sfx";
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

const EXTENSIONS_LANG: Record<Lang, Extension> = {
  python: python(),
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  java: java(),
  cpp: cpp(),
  rust: rust(),
};

const TAB: Record<Lang, number> = { python: 4, javascript: 2, typescript: 2, java: 4, cpp: 4, rust: 4 };

// Full IDE-style editing: auto-closing pairs (incl. quotes), smart Enter
// (indents between {} / after ":" and reindents on dedent), Tab indent,
// bracket matching, completion, indent guides, comment toggle, multi-cursor.
function ideExtensions(lang: Lang): Extension[] {
  return [
    EditorState.tabSize.of(TAB[lang]),
    indentUnit.of(" ".repeat(TAB[lang])),
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    rectangularSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ activateOnTyping: true, closeOnBlur: false }),
    highlightActiveLine(),
    highlightSelectionMatches(),
    indentationMarkers({ highlightActiveBlock: true, hideFirstIndent: true }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
    Prec.high(
      keymap.of([
        { key: "Enter", run: (v) => (completionStatus(v.state) === "active" ? false : insertNewlineAndIndent(v)) },
        { key: "Tab", run: acceptCompletion },
        { key: "Mod-/", run: toggleComment },
      ])
    ),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
    // typing sounds: soft per char, firmer on Enter / delete
    EditorView.domEventHandlers({
      keydown: (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return false;
        if (e.key === "Enter") sfx("keyMed", 0.28);
        else if (e.key === "Backspace" || e.key === "Delete") sfx("keyHard", 0.18);
        else if (e.key.length === 1 || e.key === "Tab") sfx("key", 0.2);
        return false;
      },
    }),
    EXTENSIONS_LANG[lang],
  ];
}

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
            onClick={() => { sfx("select", 0.4); onLangChange(l.id); }}
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
          onClick={() => { sfx("runStart", 0.5); onRun(); }}
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
          extensions={ideExtensions(lang)}
          theme={githubLight}
          height="100%"
          style={{ height: "100%", fontSize: 13 }}
          basicSetup={false}
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
              onClick={() => { sfx("popClose", 0.4); onClearRun(); }}
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
            onClick={() => { sfx(showTests ? "panelClose" : "panelOpen", 0.4); setShowTests((s) => !s); }}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase"
          >
            <FaVial className="text-neo-accent" /> Test cases ({testCases.length})
            {showTests ? <FaChevronDown /> : <FaChevronUp />}
          </button>
          <button
            onClick={() => { sfx("popOpen", 0.45); onTestCasesChange([...testCases, { input: "", expected: "" }]); }}
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
                    onClick={() => { sfx("trash", 0.4); onTestCasesChange(testCases.filter((_, j) => j !== i)); }}
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
