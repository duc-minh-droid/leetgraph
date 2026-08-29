// Tiny event bus so any view can poke the coach avatar without prop drilling.
export type CoachEvent =
  | { type: "solved"; clean: boolean }
  | { type: "assisted" }
  | { type: "failed" }
  | { type: "achievement"; name: string }
  | { type: "opened"; title: string }
  | { type: "interview-start" }
  | { type: "run-ok" }
  | { type: "run-fail" }
  | { type: "skin-equipped"; name: string };

const EVENT = "leetgraph:coach";

export function emitCoach(e: CoachEvent) {
  window.dispatchEvent(new CustomEvent<CoachEvent>(EVENT, { detail: e }));
}

export function onCoach(cb: (e: CoachEvent) => void): () => void {
  const handler = (ev: Event) => cb((ev as CustomEvent<CoachEvent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
