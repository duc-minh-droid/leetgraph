// Thin Groq client (OpenAI-compatible) used for:
//  1. generating problem statements (the CSVs only carry title/elo/topics)
//  2. describing Excalidraw whiteboard snapshots (vision model) so the
//     voice interviewer can "see" the drawing as text context.
//
// NOTE: keys live in .env.local and are exposed to the browser — this app is
// a local/preview tool. Do not deploy publicly with these keys baked in.

const KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const TEXT_MODEL = (import.meta.env.VITE_GROQ_TEXT_MODEL as string) || "openai/gpt-oss-120b";
const VISION_MODEL = (import.meta.env.VITE_GROQ_VISION_MODEL as string) || "qwen/qwen3.6-27b";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface Msg {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export function hasGroq(): boolean {
  return Boolean(KEY);
}

async function chat(model: string, messages: Msg[], maxTokens = 1600): Promise<string> {
  if (!KEY) throw new Error("VITE_GROQ_API_KEY is not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
  });
  if (!res.ok) throw new Error(`Groq ${model}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`Groq ${model}: empty response`);
  return content.trim();
}

// Generic one-shot text completion for other features (quest board, coach).
export async function askText(system: string, user: string, maxTokens = 600): Promise<string> {
  return chat(TEXT_MODEL, [
    { role: "system", content: system },
    { role: "user", content: user },
  ], maxTokens);
}

const STATEMENT_CACHE_PREFIX = "leetgraph.statement.v1.";

// Models sneak markdown in despite instructions — strip it for plain rendering.
function stripMarkdown(s: string): string {
  return s
    .replace(/^```[a-z]*\n?/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateProblemStatement(
  slug: string,
  title: string,
  difficulty: string,
  topics: string[]
): Promise<string> {
  const cacheKey = STATEMENT_CACHE_PREFIX + slug;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  const raw = await chat(TEXT_MODEL, [
    {
      role: "system",
      content:
        "You are a LeetCode problem database. Given a problem title, output its full problem statement: a clear description, two 'Example N:' blocks with Input/Output/Explanation, and a 'Constraints:' list. Plain text only — no markdown symbols (#, *, `). Never include hints, approaches, or solutions. If you are not certain of the exact problem, write a faithful statement in its spirit for the given topics.",
    },
    {
      role: "user",
      content: `Title: ${title}\nDifficulty: ${difficulty}\nTopics: ${topics.join(", ")}`,
    },
  ]);
  const statement = stripMarkdown(raw);
  localStorage.setItem(cacheKey, statement);
  return statement;
}

export async function describeBoard(pngDataUrl: string): Promise<string> {
  return chat(
    VISION_MODEL,
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "This is a candidate's whiteboard sketch during a coding interview. Describe concisely (3-5 sentences) what is drawn: data structures, labels, arrows, example walkthroughs, pseudo-code. Only describe what is visible.",
          },
          { type: "image_url", image_url: { url: pngDataUrl } },
        ],
      },
    ],
    400
  );
}
