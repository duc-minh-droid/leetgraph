import { motion } from "framer-motion";
import { Skeleton } from "boneyard-js/react";
import { FaArrowUpRightFromSquare, FaBolt, FaRotate, FaFileLines } from "react-icons/fa6";
import type { Problem } from "../../data/problems";

const DIFF_STYLE: Record<string, string> = {
  EASY: "bg-neo-ok",
  MEDIUM: "bg-neo-orange",
  HARD: "bg-neo-accent",
};

export type StatementState =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; message: string };

export function ProblemPane({
  problem,
  statement,
  onRetry,
}: {
  problem: Problem;
  statement: StatementState;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b-4 border-black bg-neo-secondary p-3">
        <h2 className="text-lg font-black uppercase leading-tight tracking-tight">
          {problem.title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase ${DIFF_STYLE[problem.difficulty] ?? "bg-white"}`}>
            {problem.difficulty}
          </span>
          <span className="flex items-center gap-1 border-2 border-black bg-white px-1.5 py-0.5 text-[10px] font-black uppercase">
            <FaBolt /> {problem.elo}
          </span>
          {problem.topics.slice(0, 4).map((t) => (
            <span key={t} className="border-2 border-black bg-white px-1.5 py-0.5 text-[10px] font-black uppercase">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {statement.status !== "error" && (
          <Skeleton
            name="problem-statement"
            loading={statement.status === "loading"}
            animate="shimmer"
            stagger
            transition
            fallback={
              <div className="flex flex-col gap-2">
                {[100, 92, 96, 60, 88, 40].map((w, i) => (
                  <motion.div
                    key={i}
                    className="h-3.5 border-2 border-black bg-white"
                    style={{ width: `${w}%` }}
                    animate={{ opacity: [0.3, 0.9, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
                <p className="mt-2 text-[11px] font-bold uppercase text-black/60">
                  Generating problem statement…
                </p>
              </div>
            }
          >
            {statement.status === "ready" && (
              <pre className="whitespace-pre-wrap font-sans text-[13px] font-medium leading-relaxed">
                {statement.text}
              </pre>
            )}
          </Skeleton>
        )}
        {statement.status === "error" && (
          <div className="flex flex-col items-start gap-2 border-4 border-black bg-white p-3 shadow-neo-sm">
            <span className="flex items-center gap-1 text-xs font-black uppercase">
              <FaFileLines /> Statement unavailable
            </span>
            <p className="text-[11px] font-bold text-black/70">{statement.message}</p>
            <button onClick={onRetry} className="flex items-center gap-1 border-2 border-black bg-neo-secondary px-2 py-1 text-[11px] font-black uppercase">
              <FaRotate /> Retry
            </button>
          </div>
        )}
      </div>

      <motion.a
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        href={problem.link}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 border-t-4 border-black bg-white px-3 py-2 text-xs font-black uppercase transition-colors hover:bg-neo-muted"
      >
        <FaArrowUpRightFromSquare /> Open on LeetCode
      </motion.a>
    </div>
  );
}
