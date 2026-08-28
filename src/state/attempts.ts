export type AttemptResult =
  | "solved"
  | "solved_with_help"
  | "failed"
  | "skipped"
  | "gave_up"
  | "abandoned";

// Diagnostic axis for a failed/abandoned attempt — the single best signal of
// *what kind* of failure it was, not just that it failed.
export type FailureMode =
  | "wrong-answer"
  | "tle"
  | "runtime-error"
  | "compile-error";

export interface Attempt {
  result: AttemptResult;
  time: number; // total seconds (legacy field; now derived from phases)
  hints: boolean;
  ai: boolean;
  verified: boolean;
  note: string;
  at: number; // epoch ms

  // --- Extended tracking (all optional for backward compat) ---

  // Time split into phases so "slow thinker" vs "slow typer" vs "slow debugger"
  // stop being conflated into one number.
  readTime?: number; // seconds: reading + thinking before first line of code
  writeTime?: number; // seconds: writing the solution
  debugTime?: number; // seconds: debugging / fixing after first run

  // Failure mode per attempt (null when solved).
  failureMode?: FailureMode | null;

  // Submitted solution's complexity vs the optimal for the problem.
  timeComplexity?: string; // e.g. "O(n)"
  spaceComplexity?: string; // e.g. "O(n)"
  optimal?: boolean; // did the Big-O match the optimal solution?
}

const KEY = "leegraph.attempts";

type AttemptLog = Record<string, Attempt[]>;

function read(): AttemptLog {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(log: AttemptLog) {
  localStorage.setItem(KEY, JSON.stringify(log));
}

export function getAttempts(slug: string): Attempt[] {
  return read()[slug] ?? [];
}

export function getAllAttempts(): AttemptLog {
  return read();
}

export function addAttempt(slug: string, attempt: Attempt) {
  const log = read();
  if (!log[slug]) log[slug] = [];
  log[slug].push(attempt);
  write(log);
}

export function touchedSlugs(): Set<string> {
  return new Set(Object.keys(read()));
}

// Wipe all attempt history (used by the "Reset" button). Effective on next load
// of the graph state, since current position is derived from this log.
export function clearAttempts() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
