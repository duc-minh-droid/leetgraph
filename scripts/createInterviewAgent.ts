/**
 * One-time setup: create (or update) the LeetGraph interviewer agent on
 * ElevenLabs Agents, backed by a Groq model via the custom-LLM integration.
 *
 * Usage:
 *   npx tsx scripts/createInterviewAgent.ts
 *
 * Reads keys from .env.local and prints the agent id — paste it into
 * VITE_ELEVENLABS_AGENT_ID in .env.local.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(import.meta.dirname ?? ".", "../.env.local");

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = readEnv();
const EL_KEY = env.VITE_ELEVENLABS_API_KEY;
const GROQ_KEY = env.VITE_GROQ_API_KEY;
const GROQ_MODEL = env.VITE_GROQ_TEXT_MODEL || "openai/gpt-oss-120b";
if (!EL_KEY || !GROQ_KEY) throw new Error("Missing keys in .env.local");

const BASE = "https://api.elevenlabs.io";
const AGENT_NAME = "LeetGraph Interviewer";

// Fallback prompt only — the app overrides this per problem at session start.
const BASE_PROMPT = `You are a senior software engineer conducting a technical
coding interview. Be concise and conversational — your replies are spoken out
loud, so keep them to one to three short sentences. Speak like a real person:
occasional natural fillers ("okay, so...", "hmm, right"), brief acknowledgments,
contractions. Never dump a full solution. Guide with Socratic questions, probe
time/space complexity, and push the candidate toward the optimal approach one
nudge at a time. The candidate uses push-to-talk and may pause to think or
code silently — be patient, don't rush them or repeat yourself. You will
receive contextual updates describing the candidate's current code, test cases
and whiteboard — use them silently to inform your next response. When the
interview reaches a natural end (candidate finishes, gives up, or time is up),
call the finish_interview tool with your honest evaluation.`;

async function el(path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  // 1. Store the Groq key as a workspace secret (idempotent-ish: reuse by name).
  const secrets = await el("/v1/convai/secrets", "GET").catch(() => ({ secrets: [] }));
  let secretId: string | undefined = secrets.secrets?.find(
    (s: { name: string }) => s.name === "leetgraph-groq-key"
  )?.secret_id;
  if (!secretId) {
    const created = await el("/v1/convai/secrets", "POST", {
      type: "new",
      name: "leetgraph-groq-key",
      value: GROQ_KEY,
    });
    secretId = created.secret_id;
  }
  console.log("Groq secret:", secretId);

  const conversationConfig = {
    agent: {
      first_message:
        "Hey, thanks for coming in today. Whenever you're ready, walk me through your understanding of the problem.",
      language: "en",
      prompt: {
        prompt: BASE_PROMPT,
        // NOTE: Groq via custom-llm silently produces no responses through
        // ElevenLabs (verified with a websocket A/B test on 2026-08-29, any
        // Groq model, with or without tools). Using an ElevenLabs-native LLM
        // for the voice agent; Groq still powers statements/vision/run-code.
        llm: "gemini-2.0-flash",
        custom_llm: null,
        temperature: 0.6,
        tools: [
          {
            type: "client",
            name: "finish_interview",
            description:
              "End the interview and submit your evaluation of the candidate's performance on this problem. Call this exactly once, when the interview concludes.",
            expects_response: false,
            parameters: {
              type: "object",
              properties: {
                result: {
                  type: "string",
                  description:
                    "Outcome: 'solved' if the candidate reached a working solution independently, 'solved_with_help' if they needed significant hints, 'gave_up' if they could not finish.",
                  enum: ["solved", "solved_with_help", "gave_up"],
                },
                hints_given: {
                  type: "boolean",
                  description: "Whether you gave meaningful hints.",
                },
                optimal: {
                  type: "boolean",
                  description: "Whether the final approach matched the optimal Big-O.",
                },
                feedback: {
                  type: "string",
                  description: "2-3 sentence summary of strengths and what to practice.",
                },
              },
              required: ["result", "hints_given", "optimal", "feedback"],
            },
          },
        ],
      },
    },
    tts: {
      // "Brian" — natural, conversational American male; swap freely.
      voice_id: "nPczCjzI2devNBz1zQrb",
      model_id: "eleven_turbo_v2",
      // Lower stability = more expressive/human delivery.
      stability: 0.4,
      similarity_boost: 0.8,
      speed: 1.0,
    },
    // Give the candidate room to think — don't jump in after short silences.
    turn: { turn_timeout: 20 },
    conversation: { max_duration_seconds: 2700 },
  };

  const platformSettings = {
    // Allow the app to inject the per-problem prompt + first message.
    overrides: {
      conversation_config_override: {
        agent: { prompt: { prompt: true }, first_message: true, language: true },
        tts: { voice_id: true },
      },
    },
    // Public auth so the client can connect by agent id alone (local preview).
    auth: { enable_auth: false },
  };

  // 2. Create or update the agent.
  const list = await el("/v1/convai/agents?page_size=100", "GET");
  const existing = list.agents?.find((a: { name: string }) => a.name === AGENT_NAME);
  let agentId: string;
  if (existing) {
    agentId = existing.agent_id;
    await el(`/v1/convai/agents/${agentId}`, "PATCH", {
      conversation_config: conversationConfig,
      platform_settings: platformSettings,
    });
    console.log("Updated agent:", agentId);
  } else {
    const created = await el("/v1/convai/agents/create", "POST", {
      name: AGENT_NAME,
      conversation_config: conversationConfig,
      platform_settings: platformSettings,
    });
    agentId = created.agent_id;
    console.log("Created agent:", agentId);
  }

  // 3. Write the agent id back into .env.local.
  const envRaw = readFileSync(ENV_PATH, "utf8");
  const next = envRaw.match(/^VITE_ELEVENLABS_AGENT_ID=.*$/m)
    ? envRaw.replace(/^VITE_ELEVENLABS_AGENT_ID=.*$/m, `VITE_ELEVENLABS_AGENT_ID=${agentId}`)
    : envRaw + `\nVITE_ELEVENLABS_AGENT_ID=${agentId}\n`;
  writeFileSync(ENV_PATH, next);
  console.log("Wrote VITE_ELEVENLABS_AGENT_ID to .env.local");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
