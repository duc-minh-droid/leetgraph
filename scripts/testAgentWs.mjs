// Diagnostic: connect to the agent's public websocket like the app does,
// send the same overrides, and print every event for 25s.
const AGENT_ID = "agent_8901m17p822qfvpax7q81wk8hfsj";
const url = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;

const ws = new WebSocket(url);
const t0 = Date.now();
let sentUser = false;
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

ws.onopen = () => {
  log("OPEN — sending initiation with overrides");
  ws.send(
    JSON.stringify({
      type: "conversation_initiation_client_data",
      conversation_config_override: {
        agent: {
          prompt: { prompt: "You are a friendly coding interviewer. Keep replies to one short sentence." },
          first_message: "Hi, ready to start the interview?",
        },
      },
    })
  );
};
ws.onmessage = (e) => {
  try {
    const d = JSON.parse(e.data);
    if (d.type === "audio") {
      log("audio chunk", (d.audio_event?.audio_base_64 ?? "").length, "b64 chars");
    } else if (d.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", event_id: d.ping_event.event_id }));
      log("ping->pong");
    } else {
      log(d.type, JSON.stringify(d).slice(0, 400));
    }
    // After the scripted first message, send a user text message to force a
    // real LLM (Groq custom-llm) generation.
    if (d.type === "agent_response" && !sentUser) {
      sentUser = true;
      log(">>> sending user_message to trigger Groq LLM");
      ws.send(JSON.stringify({ type: "user_message", text: "Yes, I'm ready. What are we doing today?" }));
    }
  } catch {
    log("raw", String(e.data).slice(0, 200));
  }
};
ws.onerror = (e) => log("ERROR", e.message ?? e);
ws.onclose = (e) => {
  log("CLOSE", e.code, e.reason || "(no reason)");
  process.exit(0);
};
setTimeout(() => {
  log("timeout, closing");
  ws.close();
}, 25000);
