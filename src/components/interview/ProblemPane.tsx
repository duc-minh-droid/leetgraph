import { motion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Skeleton } from "boneyard-js/react";
import { FaArrowUpRightFromSquare, FaBolt, FaRotate, FaFileLines } from "react-icons/fa6";
import type { Problem } from "../../data/problems";

const DIFF_STYLE: Record<string, string> = {
  EASY: "bg-neo-ok",
  MEDIUM: "bg-neo-orange",
  HARD: "bg-neo-accent",
};

const MD: Components = {
  p: ({ children }) => <p className="my-2 text-[13px] font-medium leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="mt-4 mb-1 inline-block border-2 border-black bg-neo-secondary px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide">
      {children}
    </strong>
  ),
  ul: ({ children }) => <ul className="my-2 flex flex-col gap-1 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5 text-[13px] font-medium">{children}</ol>,
  li: ({ children }) => (
    <li className="flex gap-2 text-[13px] font-medium leading-snug before:mt-[7px] before:h-1.5 before:w-1.5 before:shrink-0 before:border before:border-black before:bg-neo-accent before:content-['']">
      <span className="min-w-0">{children}</span>
    </li>
  ),
  h1: ({ children }) => <h3 className="mt-4 mb-1 text-sm font-black uppercase">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-1 text-sm font-black uppercase">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-4 mb-1 text-sm font-black uppercase">{children}</h3>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto border-2 border-black border-l-[6px] border-l-neo-blue bg-white px-3 py-2 font-mono text-[12px] font-bold leading-relaxed shadow-neo-sm">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="border border-black/40 bg-neo-bg px-1 py-px font-mono text-[12px] font-bold">{children}</code>
    ),
  blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-black bg-neo-bg px-3 py-1">{children}</blockquote>,
  table: ({ children }) => <table className="my-2 w-full border-2 border-black text-[12px]">{children}</table>,
  th: ({ children }) => <th className="border-2 border-black bg-neo-secondary px-2 py-1 text-left font-black uppercase">{children}</th>,
  td: ({ children }) => <td className="border-2 border-black px-2 py-1 font-mono font-bold">{children}</td>,
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                {statement.text}
              </ReactMarkdown>
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
