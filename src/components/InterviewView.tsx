import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { FaCode, FaChalkboard, FaCircleCheck, FaCheckDouble, FaXmark, FaPaperPlane, FaClockRotateLeft, FaChevronDown, FaChevronUp } from "react-icons/fa6";
import type { MapMeta } from "../state/library";
import type { MapNode } from "../map";
import { touchedSlugs, type Attempt, type AttemptResult } from "../state/attempts";
import { currentStreak } from "../state/analytics";
import { submitAttempt } from "../state/progress";
import { listInterviews, saveInterview, type InterviewRecord } from "../state/interviews";
import { emitCoach } from "../state/coachBus";
import { generateProblemStatement, describeBoard, hasGroq } from "../lib/groq";
import { runCode, type RunResult } from "../lib/runCode";
import { AGENT_ID, buildInterviewPrompt, buildFirstMessage } from "../lib/interviewPrompt";
import { Celebration, type CelebrationData } from "./Celebration";
import { ProblemPane, type StatementState } from "./interview/ProblemPane";
import { EditorPane, STARTER, type Lang, type TestCase } from "./interview/EditorPane";
import { BoardPane } from "./interview/BoardPane";
import { MicDock, type TranscriptLine } from "./interview/MicDock";

interface Verdict {
  result: AttemptResult;
  hints_given: boolean;
  optimal: boolean;
  feedback: string;
}

function InterviewInner({ map, onAttempt }: { map: MapMeta; onAttempt?: () => void }) {
  // ---- problem selection: nodes reachable from the deepest attempted node ----
  const [rev, setRev] = useState(0);
  const available = useMemo(() => {
    void rev;
    const touched = touchedSlugs();
    let best: MapNode | null = null;
    for (const n of map.nodes) if (touched.has(n.slug) && (!best || n.row > best.row)) best = n;
    const nodes = best
      ? best.edges_out
          .map((id) => map.nodes.find((n) => n.id === id))
          .filter((n): n is MapNode => Boolean(n))
      : map.nodes.filter((n) => n.row === 0);
    return nodes;
  }, [map, rev]);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedSlug || !available.some((n) => n.slug === selectedSlug)) {
      setSelectedSlug(available[0]?.slug ?? null);
    }
  }, [available, selectedSlug]);
  const problem = selectedSlug ? map.problems[selectedSlug] : null;

  // ---- problem statement (Groq-generated, cached) ----
  const [statement, setStatement] = useState<StatementState>({ status: "loading" });
  const loadStatement = useCallback(() => {
    if (!problem) return;
    if (!hasGroq()) {
      setStatement({ status: "error", message: "VITE_GROQ_API_KEY is not set — add it to .env.local. Meanwhile, read the problem on LeetCode below." });
      return;
    }
    setStatement({ status: "loading" });
    generateProblemStatement(problem.slug, problem.title, problem.difficulty, problem.topics)
      .then((text) => setStatement({ status: "ready", text }))
      .catch((e) => setStatement({ status: "error", message: String(e?.message ?? e) }));
  }, [problem?.slug]);
  useEffect(loadStatement, [loadStatement]);

  // ---- editor + board ----
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(STARTER.python);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [pane, setPane] = useState<"code" | "board">("code");
  const excalRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const boardDirty = useRef(false);
  const [sharingBoard, setSharingBoard] = useState(false);
  useEffect(() => {
    setCode(STARTER[lang]);
  }, [lang, problem?.slug]);
  useEffect(() => {
    setTestCases([]);
  }, [problem?.slug]);

  // ---- run code (Wandbox) ----
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await runCode(lang, code);
      setRunResult(result);
      emitCoach({ type: result.ok ? "run-ok" : "run-fail" });
      if (statusRef.current === "connected") {
        sendContextualUpdate(
          `[RUN RESULT] The candidate ran their code (${result.ok ? "success" : "failure"}, ${result.ms}ms). Output:\n${result.output.slice(0, 1500)}`
        );
      }
    } catch (e) {
      setRunResult({ ok: false, output: `Runner unreachable: ${String(e)}`, ms: 0 });
    } finally {
      setRunning(false);
    }
  };

  // ---- conversation ----
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  // Push-to-talk: controlled mic state. Controlled `micMuted` is applied by the
  // SDK only while a session exists — never call setMuted() before startSession,
  // it throws and kills the start flow.
  const [micOpen, setMicOpen] = useState(false);
  const conversation = useConversation({
    micMuted: !micOpen,
    onMessage: ({ role, message }) => setTranscript((t) => [...t, { role, message }]),
    onError: (message, context) => {
      console.error("[interview] conversation error:", message, context);
      setLastError(message);
    },
    onConnect: () => setLastError(null),
    onDisconnect: (details) => {
      console.warn("[interview] disconnected:", details);
      if (details.reason === "error") setLastError(details.message);
      setSessionEnded(true);
    },
  });
  const {
    status,
    isSpeaking,
    startSession,
    endSession,
    sendContextualUpdate,
    sendUserActivity,
  } = conversation;
  const live = status === "connected";
  const statusRef = useRef(status);
  statusRef.current = status;

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  useEffect(() => {
    if (!live || startedAt === null) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [live, startedAt]);

  const start = () => {
    if (!problem || statement.status !== "ready" || !AGENT_ID) return;
    setTranscript([]);
    setVerdict(null);
    setSessionEnded(false);
    setElapsed(0);
    setStartedAt(Date.now());
    // Push-to-talk: mic starts closed so the interviewer never hears half-thoughts.
    setMicOpen(false);
    emitCoach({ type: "interview-start" });
    startSession({
      agentId: AGENT_ID,
      connectionType: "websocket",
      overrides: {
        agent: {
          prompt: { prompt: buildInterviewPrompt(problem, statement.text, map.name) },
          firstMessage: buildFirstMessage(problem),
        },
      },
    });
  };

  // ---- context streaming: code + test case snapshots (debounced 2.5s) ----
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => {
      const tests = testCases
        .filter((tc) => tc.input.trim() || tc.expected.trim())
        .map((tc, i) => `${i + 1}. input: ${tc.input} -> expected: ${tc.expected}`)
        .join("\n");
      sendContextualUpdate(
        `[CODE SNAPSHOT — ${lang}]\n${code.trim() || "(editor is empty)"}` +
          (tests ? `\n[TEST CASES]\n${tests}` : "")
      );
    }, 2500);
    return () => clearTimeout(t);
  }, [code, lang, testCases, live, sendContextualUpdate]);

  // ---- context streaming: whiteboard (vision, throttled 15s + manual) ----
  const shareBoard = useCallback(async () => {
    const api = excalRef.current;
    if (!api || sharingBoard) return;
    const elements = api.getSceneElements();
    if (!elements.length) return;
    setSharingBoard(true);
    boardDirty.current = false;
    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportWithDarkMode: false },
        files: api.getFiles(),
        mimeType: "image/png",
        maxWidthOrHeight: 1200,
      });
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const desc = await describeBoard(dataUrl);
      sendContextualUpdate(`[WHITEBOARD] The candidate's current whiteboard:\n${desc}`);
    } catch {
      // Vision unavailable — fall back to the board's text labels.
      const texts = excalRef.current
        ?.getSceneElements()
        .filter((e) => e.type === "text")
        .map((e) => (e as { text?: string }).text)
        .filter(Boolean);
      if (texts?.length) {
        sendContextualUpdate(`[WHITEBOARD] Text labels on the candidate's whiteboard: ${texts.join(" | ")}`);
      }
    } finally {
      setSharingBoard(false);
    }
  }, [sharingBoard, sendContextualUpdate]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      if (boardDirty.current) void shareBoard();
    }, 15000);
    return () => clearInterval(t);
  }, [live, shareBoard]);

  // ---- finish_interview client tool -> prefilled log modal ----
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [showLog, setShowLog] = useState(false);
  useConversationClientTool("finish_interview", (params: Record<string, unknown>) => {
    setVerdict({
      result: (params.result as AttemptResult) ?? "solved_with_help",
      hints_given: Boolean(params.hints_given),
      optimal: Boolean(params.optimal),
      feedback: String(params.feedback ?? ""),
    });
    setShowLog(true);
  });

  // ---- logging the attempt ----
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const logAttempt = (v: Verdict) => {
    if (!problem) return;
    const attempt: Attempt = {
      result: v.result,
      time: elapsed,
      hints: v.hints_given,
      ai: false,
      verified: false,
      note: v.feedback ? `[Interview] ${v.feedback}` : "[Interview]",
      at: Date.now(),
      readTime: 0,
      writeTime: elapsed,
      debugTime: 0,
      failureMode: null,
      timeComplexity: "",
      spaceComplexity: "",
      optimal: v.optimal,
    };
    const outcome = submitAttempt(problem.slug, attempt, { difficulty: problem.difficulty });
    saveInterview({
      at: Date.now(),
      slug: problem.slug,
      title: problem.title,
      durationS: elapsed,
      lang,
      code,
      result: v.result,
      feedback: v.feedback,
      transcript,
    });
    if (live) endSession();
    setShowLog(false);
    setVerdict(null);
    setSessionEnded(false);
    setStartedAt(null);
    setCelebration({
      kind: v.result === "solved" ? "solved" : v.result === "solved_with_help" ? "assisted" : "logged",
      title: problem.title,
      elo: problem.elo,
      streak: currentStreak(),
      seq: Date.now(),
      ratingDelta: outcome.ratingDelta,
      ratingAfter: outcome.ratingAfter,
      achievements: outcome.newAchievements.map((x) => x.name),
      questCompleted: outcome.questJustCompleted,
      crit: outcome.crit,
      effectNotes: outcome.effectNotes,
      curseGained: outcome.curseGained,
      curseCleansed: outcome.curseCleansed,
      combo: outcome.comboToday,
      xpEarned: outcome.xpEarned,
      levelUp: outcome.leveledUp,
      farmed: outcome.farmed,
    });
    if (outcome.newAchievements.length > 0) {
      emitCoach({ type: "achievement", name: outcome.newAchievements[0].name });
    } else if (v.result === "solved") {
      emitCoach({ type: "solved", clean: !v.hints_given });
    } else if (v.result === "solved_with_help") {
      emitCoach({ type: "assisted" });
    } else {
      emitCoach({ type: "failed" });
    }
    setRev((r) => r + 1);
    onAttempt?.();
  };

  // ---- past interviews ----
  const [showHistory, setShowHistory] = useState(false);
  const history = useMemo(() => listInterviews().slice().reverse(), [showHistory, rev]);

  useEffect(() => () => endSession(), [endSession]);

  if (!problem) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <div className="border-4 border-black bg-white p-6 text-sm font-black uppercase shadow-neo">
          No problems available on this map.
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 p-2 md:p-5">
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* Left: problem (stacks on top on mobile, capped height) */}
        <div className="flex max-h-[34dvh] w-full shrink-0 flex-col overflow-hidden border-4 border-black bg-white shadow-neo lg:max-h-none lg:w-[340px]">
          {available.length > 1 && (
            <div className="flex flex-wrap gap-1 border-b-4 border-black bg-neo-bg p-2">
              {available.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedSlug(n.slug)}
                  disabled={live}
                  className={`border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase disabled:opacity-50 ${
                    n.slug === selectedSlug ? "bg-neo-secondary" : "bg-white text-black/60"
                  }`}
                >
                  {map.problems[n.slug]?.title ?? n.slug}
                </button>
              ))}
            </div>
          )}
          <ProblemPane problem={problem} statement={statement} onRetry={loadStatement} />
        </div>

        {/* Right: editor / whiteboard */}
        <div className="flex min-h-[45dvh] min-w-0 flex-1 flex-col overflow-hidden border-4 border-black bg-white shadow-neo lg:min-h-0">
          <div className="flex border-b-4 border-black bg-neo-bg">
            {(
              [
                { id: "code", label: "Code", icon: <FaCode key="c" /> },
                { id: "board", label: "Whiteboard", icon: <FaChalkboard key="b" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setPane(t.id)}
                className={`flex items-center gap-2 border-r-4 border-black px-4 py-2 text-xs font-black uppercase transition-colors ${
                  pane === t.id ? "bg-neo-secondary" : "bg-white text-black/50 hover:text-black"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory((s) => !s)}
                className={`ml-auto flex items-center gap-2 border-l-4 border-black px-4 py-2 text-xs font-black uppercase transition-colors ${
                  showHistory ? "bg-neo-muted" : "bg-white text-black/50 hover:text-black"
                }`}
              >
                <FaClockRotateLeft /> History ({history.length})
              </button>
            )}
          </div>
          <div className="relative min-h-0 flex-1">
            <div className={`absolute inset-0 ${pane === "code" ? "" : "invisible"}`}>
              <EditorPane
                code={code}
                lang={lang}
                testCases={testCases}
                running={running}
                runResult={runResult}
                onChange={setCode}
                onLangChange={setLang}
                onTestCasesChange={setTestCases}
                onRun={() => void run()}
                onClearRun={() => setRunResult(null)}
              />
            </div>
            <div className={`absolute inset-0 ${pane === "board" ? "" : "invisible"}`}>
              <BoardPane
                onApiReady={(api) => (excalRef.current = api)}
                onSceneChange={() => (boardDirty.current = true)}
              />
            </div>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 60, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="absolute inset-y-0 right-0 z-20 w-full max-w-[420px] overflow-y-auto border-l-4 border-black bg-neo-bg p-3 shadow-[-8px_0_0_0_#000]"
                >
                  <div className="mb-2 text-sm font-black uppercase">Past interviews</div>
                  <div className="flex flex-col gap-2">
                    {history.map((rec) => (
                      <HistoryCard key={rec.at} rec={rec} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <MicDock
        status={status}
        isSpeaking={isSpeaking}
        isMuted={!micOpen}
        elapsed={elapsed}
        transcript={transcript}
        canStart={statement.status === "ready" && Boolean(AGENT_ID)}
        agentMissing={!AGENT_ID}
        statementPending={statement.status !== "ready"}
        error={lastError}
        sharingBoard={sharingBoard}
        hasSessionEnded={sessionEnded && startedAt !== null}
        onStart={start}
        onEnd={() => {
          endSession();
          setSessionEnded(true);
        }}
        onToggleMute={() => {
          // Opening the mic signals activity so the agent yields the turn.
          if (!micOpen && live) sendUserActivity();
          setMicOpen((o) => !o);
        }}
        onShareBoard={() => void shareBoard()}
        onLogAttempt={() => setShowLog(true)}
      />

      <AnimatePresence>
        {showLog && (
          <LogModal
            verdict={verdict}
            onCancel={() => setShowLog(false)}
            onSubmit={logAttempt}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}
      </AnimatePresence>
    </div>
  );
}

function HistoryCard({ rec }: { rec: InterviewRecord }) {
  const [open, setOpen] = useState(false);
  const ok = rec.result === "solved" || rec.result === "solved_with_help";
  return (
    <div className="border-4 border-black bg-white shadow-neo-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-xs font-black uppercase">{rec.title}</div>
          <div className="text-[10px] font-bold uppercase text-black/60">
            {new Date(rec.at).toLocaleString()} · {Math.round(rec.durationS / 60)}m · {rec.lang}
          </div>
        </div>
        <span className={`shrink-0 border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase ${ok ? "bg-neo-ok" : "bg-neo-accent"}`}>
          {rec.result.replace(/_/g, " ")}
        </span>
        {open ? <FaChevronUp className="shrink-0" /> : <FaChevronDown className="shrink-0" />}
      </button>
      {open && (
        <div className="border-t-2 border-black p-3">
          {rec.feedback && (
            <p className="mb-2 border-2 border-black bg-neo-secondary p-2 text-[11px] font-bold">
              “{rec.feedback}”
            </p>
          )}
          {rec.code && (
            <pre className="mb-2 max-h-40 overflow-auto border-2 border-black bg-black p-2 font-mono text-[10px] font-bold leading-relaxed text-neo-ok">
              {rec.code}
            </pre>
          )}
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {rec.transcript.map((l, i) => (
              <p key={i} className="text-[11px] font-bold leading-snug">
                <span className={`mr-1 uppercase ${l.role === "agent" ? "text-neo-accent" : "text-black/50"}`}>
                  {l.role === "agent" ? "Interviewer" : "You"}:
                </span>
                {l.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogModal({
  verdict,
  onCancel,
  onSubmit,
}: {
  verdict: Verdict | null;
  onCancel: () => void;
  onSubmit: (v: Verdict) => void;
}) {
  const [result, setResult] = useState<AttemptResult>(verdict?.result ?? "solved");
  const [hints, setHints] = useState(verdict?.hints_given ?? false);
  const [optimal, setOptimal] = useState(verdict?.optimal ?? false);
  const [feedback, setFeedback] = useState(verdict?.feedback ?? "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4"
    >
      <motion.div
        initial={{ scale: 0.85, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="w-full max-w-md border-4 border-black bg-neo-bg p-4 shadow-neo-lg"
      >
        <h3 className="text-lg font-black uppercase">
          {verdict ? "Interviewer's verdict" : "Log this interview"}
        </h3>
        {verdict && (
          <p className="mt-1 border-2 border-black bg-white p-2 text-xs font-bold">
            “{verdict.feedback}”
          </p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              { val: "solved", label: "Solved", icon: <FaCircleCheck key="i" />, cls: "bg-neo-ok" },
              { val: "solved_with_help", label: "With help", icon: <FaCheckDouble key="i" />, cls: "bg-neo-muted" },
              { val: "gave_up", label: "Gave up", icon: <FaXmark key="i" />, cls: "bg-neo-accent" },
            ] as const
          ).map((o) => (
            <button
              key={o.val}
              onClick={() => setResult(o.val)}
              className={`flex items-center justify-center gap-1 border-4 border-black px-2 py-2 text-[11px] font-black uppercase ${
                result === o.val ? `${o.cls} shadow-neo-sm` : "bg-white text-black/50"
              }`}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              { label: "Hints given", val: hints, set: setHints },
              { label: "Optimal Big-O", val: optimal, set: setOptimal },
            ] as { label: string; val: boolean; set: (b: boolean) => void }[]
          ).map((o) => (
            <button
              key={o.label}
              onClick={() => o.set(!o.val)}
              className={`border-4 border-black px-2 py-2 text-[11px] font-black uppercase ${
                o.val ? "bg-neo-secondary shadow-neo-sm" : "bg-white text-black/50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <textarea
          className="neo-input mt-2 min-h-[64px] resize-y text-xs"
          placeholder="Notes / interviewer feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />

        <div className="mt-3 flex gap-2">
          <button onClick={onCancel} className="neo-btn neo-btn-ghost flex-1 !py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ result, hints_given: hints, optimal, feedback })}
            className="neo-btn flex-1 !py-2 text-xs"
          >
            <FaPaperPlane /> Log attempt
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function InterviewView({
  map,
  onAttempt,
}: {
  map: MapMeta;
  onAttempt?: () => void;
}) {
  return (
    <ConversationProvider>
      <InterviewInner map={map} onAttempt={onAttempt} />
    </ConversationProvider>
  );
}
