import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightActiveLine, highlightActiveLineGutter, lineNumbers, rectangularSelection, dropCursor } from "@codemirror/view";
import { history, historyKeymap, defaultKeymap, indentWithTab, insertNewlineAndIndent, toggleComment } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, acceptCompletion, completionStatus } from "@codemirror/autocomplete";
import { bracketMatching, indentOnInput, indentUnit, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { githubLight } from "@uiw/codemirror-theme-github";
import { FaPlus, FaXmark, FaChevronDown, FaChevronUp, FaPlay, FaSpinner, FaCheck, FaTriangleExclamation } from "react-icons/fa6";
import { sfx } from "../../lib/sfx";
import type { Lang } from "../../lib/lc";
import type { RunResult } from "../../lib/runCode";
import type { JudgeResult, CaseResult } from "../../lib/judge";
import type { ProblemSpec } from "../../lib/spec";

export type { Lang };

export const LANGS: { id: Lang; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "rust", label: "Rust" },
];

const LANG_EXT: Record<Lang, Extension> = { python: python(), rust: rust() };
const TAB: Record<Lang, number> = { python: 4, rust: 4 };

// Full IDE-style editing: auto-closing pairs, smart Enter / indent, Tab indent,
// bracket matching, completion, indent guides, comment toggle, multi-cursor,
// plus run shortcuts (Ctrl+' / Ctrl+Enter).
function ideExtensions(lang: Lang, hooks: { run: () => void }): Extension[] {
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
    Prec.highest(
      keymap.of([
        { key: "Mod-'", run: () => (hooks.run(), true) },
        { key: "Mod-Enter", run: () => (hooks.run(), true) },
      ])
    ),
    Prec.high(
      keymap.of([
        { key: "Enter", run: (v) => (completionStatus(v.state) === "active" ? false : insertNewlineAndIndent(v)) },
        { key: "Tab", run: acceptCompletion },
        { key: "Mod-/", run: toggleComment },
      ])
    ),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
    EditorView.domEventHandlers({
      keydown: (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return false;
        if (e.key === "Enter") sfx("keyMed", 0.28);
        else if (e.key === "Backspace" || e.key === "Delete") sfx("keyHard", 0.18);
        else if (e.key.length === 1 || e.key === "Tab") sfx("key", 0.2);
        return false;
      },
    }),
    LANG_EXT[lang],
  ];
}

export type SpecState = "loading" | "ready" | "unavailable";

const VERDICT_STYLE: Record<string, string> = {
  Accepted: "text-[#15803d]",
  "Wrong Answer": "text-[#dc2626]",
  "Runtime Error": "text-[#dc2626]",
  "Compile Error": "text-[#dc2626]",
  "Time Limit Exceeded": "text-[#d97706]",
};

function Block({ label, children, tone = "" }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-black/50">{label}</span>
      <pre className={`max-h-32 overflow-auto whitespace-pre-wrap break-all border-2 border-black bg-white px-2 py-1.5 font-mono text-[12px] font-bold ${tone}`}>
        {children}
      </pre>
    </div>
  );
}

function CaseChip({ label, state, active, onClick, onRemove }: { label: string; state?: CaseResult["status"]; active: boolean; onClick: () => void; onRemove?: () => void }) {
  const dot =
    state === "pass" ? "bg-neo-ok" : state === "fail" || state === "error" || state === "tle" ? "bg-neo-accent" : state === "ran" ? "bg-neo-muted" : "";
  return (
    <span className={`group/chip relative inline-flex items-center border-2 border-black text-[11px] font-black uppercase ${active ? "bg-neo-secondary" : "bg-white hover:bg-neo-bg"}`}>
      <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-0.5">
        {dot && <span className={`h-2 w-2 border border-black ${dot}`} />}
        {label}
      </button>
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove ${label}`} className="border-l-2 border-black px-1 py-0.5 text-[9px] hover:bg-neo-accent">
          <FaXmark />
        </button>
      )}
    </span>
  );
}

export function EditorPane({
  code,
  lang,
  spec,
  specState,
  cases,
  busy,
  result,
  raw,
  onChange,
  onLangChange,
  onCasesChange,
  onRun,
  onClearResult,
}: {
  code: string;
  lang: Lang;
  spec: ProblemSpec | null;
  specState: SpecState;
  cases: string[][];
  busy: "run" | null;
  result: JudgeResult | null;
  raw: RunResult | null;
  onChange: (code: string) => void;
  onLangChange: (l: Lang) => void;
  onCasesChange: (c: string[][]) => void;
  onRun: () => void;
  onClearResult: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"cases" | "result">("cases");
  const [sel, setSel] = useState(0);
  const [resSel, setResSel] = useState(0);

  // Latest callbacks for the CodeMirror keymap (extensions are built once per language).
  const hooks = useRef({ run: onRun });
  hooks.current = { run: onRun };
  const extensions = useMemo(
    () => ideExtensions(lang, { run: () => hooks.current.run() }),
    [lang]
  );

  // A new result jumps to the result tab, focused on the first failing case.
  useEffect(() => {
    if (!result && !raw) return;
    setOpen(true);
    setTab("result");
    setResSel(result?.failedIndex ?? 0);
  }, [result, raw]);
  useEffect(() => {
    if (sel >= cases.length) setSel(Math.max(0, cases.length - 1));
  }, [cases.length, sel]);

  const setArg = (ci: number, pi: number, v: string) =>
    onCasesChange(cases.map((c, i) => (i === ci ? c.map((x, j) => (j === pi ? v : x)) : c)));
  const badJson = (v: string) => {
    try {
      JSON.parse(v);
      return false;
    } catch {
      return true;
    }
  };
  const canTest = specState === "ready" && spec;
  const cur = result?.cases[resSel];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b-4 border-black bg-neo-bg px-2 py-1.5">
        {LANGS.map((l) => (
          <motion.button
            key={l.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              sfx("select", 0.4);
              onLangChange(l.id);
            }}
            className={`border-2 border-black px-2 py-0.5 text-[11px] font-black uppercase transition-colors duration-100 ${
              lang === l.id ? "bg-neo-secondary" : "bg-white text-black/50 hover:text-black"
            }`}
          >
            {l.label}
          </motion.button>
        ))}
        <span className="ml-2 hidden text-[10px] font-bold uppercase text-black/40 md:inline">
          {specState === "loading" ? "Preparing judge…" : specState === "unavailable" ? "No test harness for this problem" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={onRun}
            disabled={busy !== null || specState === "loading"}
            title="Run (Ctrl+Enter)"
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-0.5 text-[11px] font-black uppercase shadow-neo-sm disabled:opacity-50"
          >
            {busy === "run" ? <FaSpinner className="animate-spin" /> : <FaPlay />}
            {busy === "run" ? "Running…" : "Run"}
          </motion.button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={code}
          onChange={onChange}
          extensions={extensions}
          theme={githubLight}
          height="100%"
          style={{ height: "100%", fontSize: 13 }}
          basicSetup={false}
        />
      </div>

      {/* ---- console: Testcase | Test Result ---- */}
      <div className="flex max-h-[46%] shrink-0 flex-col border-t-4 border-black bg-neo-bg">
        <div className="flex items-center gap-1 border-b-2 border-black px-2 py-1">
          {(["cases", "result"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                sfx("tab", 0.35);
                setOpen(true);
                setTab(t);
              }}
              className={`border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase ${tab === t && open ? "bg-neo-secondary" : "bg-white text-black/50 hover:text-black"}`}
            >
              {t === "cases" ? "Testcase" : "Test Result"}
              {t === "result" && result && (
                <span className={`ml-1.5 inline-block h-2 w-2 border border-black ${result.verdict === "Accepted" ? "bg-neo-ok" : "bg-neo-accent"}`} />
              )}
            </button>
          ))}
          <button
            onClick={() => {
              sfx(open ? "panelClose" : "panelOpen", 0.4);
              setOpen((o) => !o);
            }}
            aria-label={open ? "Collapse console" : "Expand console"}
            className="ml-auto grid h-6 w-6 place-items-center border-2 border-black bg-white text-[10px]"
          >
            {open ? <FaChevronDown /> : <FaChevronUp />}
          </button>
        </div>

        {open && (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {tab === "cases" &&
              (canTest ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cases.map((_, i) => (
                      <CaseChip
                        key={i}
                        label={`Case ${i + 1}`}
                        active={sel === i}
                        onClick={() => setSel(i)}
                        onRemove={
                          cases.length > 1
                            ? () => {
                                sfx("trash", 0.4);
                                onCasesChange(cases.filter((_, j) => j !== i));
                              }
                            : undefined
                        }
                      />
                    ))}
                    <button
                      onClick={() => {
                        sfx("popOpen", 0.45);
                        const base = cases[sel] ?? spec!.params.map(() => "");
                        onCasesChange([...cases, [...base]]);
                        setSel(cases.length);
                      }}
                      aria-label="Add test case"
                      className="grid h-6 w-6 place-items-center border-2 border-black bg-white text-[10px] hover:bg-neo-secondary"
                    >
                      <FaPlus />
                    </button>
                  </div>
                  {cases[sel] &&
                    spec!.params.map((p, pi) => (
                      <label key={p.name} className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-black/60">
                          {p.name} = <span className="font-mono text-[10px] text-black/35">{p.type}</span>
                        </span>
                        <textarea
                          rows={1}
                          spellCheck={false}
                          value={cases[sel][pi] ?? ""}
                          onChange={(e) => setArg(sel, pi, e.target.value)}
                          className={`resize-y border-2 border-black bg-white px-2 py-1.5 font-mono text-[12px] font-bold focus:bg-neo-secondary/40 focus:outline-none ${
                            badJson(cases[sel][pi] ?? "") ? "!border-neo-accent" : ""
                          }`}
                        />
                      </label>
                    ))}
                </div>
              ) : (
                <p className="p-1 text-[11px] font-bold uppercase text-black/50">
                  {specState === "loading"
                    ? "Building the judge for this problem…"
                    : "Linked-list / tree / design problems can't be auto-tested yet. Run executes your file as a plain program."}
                </p>
              ))}

            {tab === "result" && (
              <>
                {!result && !raw && <p className="p-1 text-[11px] font-bold uppercase text-black/50">Run your code to see results here.</p>}

                {raw && !result && (
                  <div className="flex flex-col gap-1.5">
                    <div className={`flex items-center justify-between text-[11px] font-black uppercase ${raw.ok ? "text-[#15803d]" : "text-[#dc2626]"}`}>
                      <span>
                        {raw.ok ? "Ran OK" : "Failed"} · {raw.ms}ms
                      </span>
                      <button onClick={onClearResult} aria-label="Clear" className="grid h-5 w-5 place-items-center border-2 border-black bg-white text-[10px] text-black">
                        <FaXmark />
                      </button>
                    </div>
                    <pre className="max-h-40 overflow-auto bg-black px-3 py-2 font-mono text-[11px] font-bold leading-relaxed text-neo-ok">{raw.output}</pre>
                  </div>
                )}

                {result && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className={`flex items-center gap-1.5 text-lg font-black ${VERDICT_STYLE[result.verdict]}`}>
                        {result.verdict === "Accepted" ? <FaCheck /> : <FaTriangleExclamation />} {result.verdict}
                      </span>
                      {result.cases.length > 0 && (
                        <span className="text-[11px] font-bold text-black/60">
                          {result.passed} / {result.total} cases passed · Runtime {result.ms} ms
                        </span>
                      )}
                      <button onClick={onClearResult} aria-label="Clear" className="ml-auto grid h-5 w-5 place-items-center border-2 border-black bg-white text-[10px]">
                        <FaXmark />
                      </button>
                    </div>
                                        {result.message && (
                      <pre className="max-h-44 overflow-auto whitespace-pre-wrap border-2 border-black bg-[#fee2e2] px-2 py-1.5 font-mono text-[11px] font-bold text-[#991b1b]">
                        {result.message}
                      </pre>
                    )}

                    {result.cases.length > 0 && (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {result.cases.map((c, i) => (
                            <CaseChip
                              key={i}
                              label={`Case ${i + 1}`}
                              state={c.status}
                              active={resSel === i}
                              onClick={() => setResSel(i)}
                            />
                          ))}
                        </div>
                        {cur && spec && (
                          <div className="flex flex-col gap-2">
                            <Block label="Input">
                              {spec.params.map((p, i) => `${p.name} = ${cur.args[i]}`).join("\n")}
                            </Block>
                            {cur.error && <Block label={cur.status === "tle" ? "Time limit" : "Error"} tone="!bg-[#fee2e2] !text-[#991b1b]">{cur.error}</Block>}
                            {cur.status === "tle" && <Block label="Error" tone="!bg-[#fee2e2] !text-[#991b1b]">Time Limit Exceeded (&gt; 3s)</Block>}
                            {cur.output !== undefined && (
                              <Block label="Output" tone={cur.status === "fail" ? "!bg-[#fee2e2]" : cur.status === "pass" ? "!bg-[#dcfce7]" : ""}>
                                {cur.output}
                              </Block>
                            )}
                            {cur.expected !== undefined && <Block label="Expected">{cur.expected}</Block>}
                            {cur.stdout ? <Block label="Stdout">{cur.stdout}</Block> : null}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
