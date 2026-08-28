import { getAttempts, type AttemptResult } from "./attempts";

export type NodeStatus =
  | "unseen"
  | "in_progress"
  | "solved"
  | "solved_with_help"
  | "failed"
  | "skipped";

// A node's status is always derived from the attempt log — never stored
// redundantly. The latest attempt decides the terminal status.
export function deriveNodeStatus(slug: string): NodeStatus {
  const attempts = getAttempts(slug);
  if (attempts.length === 0) return "unseen";
  const last = attempts[attempts.length - 1];
  switch (last.result as AttemptResult) {
    case "solved":
      return "solved";
    case "solved_with_help":
      return "solved_with_help";
    case "skipped":
      return "skipped";
    case "failed":
    case "gave_up":
    case "abandoned":
      return "failed";
    default:
      return "failed";
  }
}

// "in_progress" is layered on top by the view: a reachable (available) node
// that has no successful attempt yet.
export function isTouched(slug: string): boolean {
  return getAttempts(slug).length > 0;
}
