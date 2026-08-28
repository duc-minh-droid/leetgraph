import raw from "../../maps/amazon.csv?raw";
import { parseProblems, type Problem } from "./problems-core";

export type { Problem, Difficulty } from "./problems-core";

export const PROBLEMS: Problem[] = parseProblems(raw);

export const PROBLEM_BY_SLUG: Record<string, Problem> = Object.fromEntries(
  PROBLEMS.map((p) => [p.slug, p])
);
