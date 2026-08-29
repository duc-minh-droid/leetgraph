import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, type TargetAndTransition } from "framer-motion";
import { createAvatar } from "@bible-strong/avatar-react";
import "@bible-strong/avatar-react/styles.css";
import { onCoach, type CoachEvent } from "../state/coachBus";
import { equippedSkin, skinForAchievementName, COACH_SKINS } from "../state/coachSkins";

// All skins share the standard animation set.
export type CoachAnim =
  | "sleeping" | "waking" | "idle" | "listening" | "thinking" | "searching"
  | "working" | "excited" | "bored" | "suspicious" | "angry" | "drowsy"
  | "happy" | "curious" | "confused" | "surprised" | "proud" | "shy"
  | "sad" | "laughing" | "scared" | "playful" | "celebrate";

interface LooseAvatarProps {
  defaultAnimation?: string;
  size?: number;
  ariaLabel?: string;
}
type SkinComponent = (props: LooseAvatarProps) => React.ReactNode;

// createAvatar validates each definition once; components are cached per skin.
const componentCache = new Map<string, SkinComponent>();
function skinComponent(id: string): SkinComponent {
  const cached = componentCache.get(id);
  if (cached) return cached;
  const skin = COACH_SKINS.find((s) => s.id === id) ?? COACH_SKINS[0];
  let comp: SkinComponent;
  try {
    comp = createAvatar(skin.def as never) as unknown as SkinComponent;
  } catch (e) {
    // A bad definition must never take a page down — fall back to the starter.
    console.error(`[coach] invalid skin "${id}", falling back to starter:`, e);
    comp =
      id === COACH_SKINS[0].id
        ? () => null
        : skinComponent(COACH_SKINS[0].id);
  }
  componentCache.set(id, comp);
  return comp;
}

// Whole-body movement per mood, layered on top of the face animation.
const BOUNCE: TargetAndTransition = {
  y: [0, -16, 0, -12, 0, -6, 0],
  rotate: [0, -8, 8, -6, 6, -3, 0],
  scale: [1, 1.1, 1, 1.08, 1, 1.04, 1],
  transition: { duration: 1.5, repeat: 2, ease: "easeOut" },
};
const FREAKOUT: TargetAndTransition = {
  y: [0, -20, 0, -18, 0, -14, 0],
  x: [0, -5, 5, -5, 5, -3, 0],
  rotate: [0, -12, 12, -10, 10, -5, 0],
  scale: [1, 1.15, 1, 1.12, 1, 1.06, 1],
  transition: { duration: 1.3, repeat: 3, ease: "easeOut" },
};
const SHAKE: TargetAndTransition = {
  x: [0, -4, 4, -4, 4, -2, 0],
  rotate: [0, -3, 3, -3, 3, 0],
  transition: { duration: 0.6, repeat: 3 },
};
const BOB: TargetAndTransition = {
  y: [0, -4, 0],
  rotate: [-2, 2, -2],
  transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
};
const SWAY: TargetAndTransition = {
  rotate: [-4, 4, -4],
  y: [0, 3, 0],
  transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
};
const SLUMP: TargetAndTransition = {
  rotate: [7, 10, 7],
  y: [2, 6, 2],
  scale: [1, 1.03, 1],
  transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
};
const WIGGLE: TargetAndTransition = {
  rotate: [0, -14, 14, -10, 6, 0],
  y: [0, -10, 0, -6, 0, 0],
  transition: { duration: 1.1, ease: "easeOut" },
};
const PUFF: TargetAndTransition = {
  scale: [1, 1.12, 1.08],
  y: [0, -6, -3],
  rotate: [0, -2, 0],
  transition: { duration: 0.9, ease: "easeOut" },
};

function moveFor(anim: CoachAnim): TargetAndTransition {
  switch (anim) {
    case "celebrate":
      return BOUNCE;
    case "excited":
    case "laughing":
      return FREAKOUT;
    case "surprised":
    case "scared":
    case "angry":
    case "suspicious":
      return SHAKE;
    case "sad":
    case "confused":
    case "drowsy":
    case "shy":
    case "bored":
      return SWAY;
    case "sleeping":
      return SLUMP;
    case "playful":
    case "waking":
    case "happy":
      return WIGGLE;
    case "proud":
      return PUFF;
    default:
      return BOB; // idle, listening, thinking, working, curious, searching
  }
}

// Moods that persist until something else happens.
const SUSTAINED = new Set<CoachAnim>(["idle", "sleeping", "listening", "thinking", "working"]);

const LINES: Record<string, string[]> = {
  "solved-clean": ["FLAWLESS. LET'S GO!", "No hints, no mercy!", "Clean kill. Next!", "That's interview-ready."],
  solved: ["GG! Node cleared!", "Another one down!", "The map bends to you.", "Solid. Keep climbing."],
  assisted: ["A win's a win!", "You got there — it counts.", "Next time, solo. I believe."],
  failed: ["Shake it off.", "That one owes you a rematch.", "Failures feed the rating comeback.", "Log it, learn it, beat it."],
  achievement: ["NEW ACHIEVEMENT!", "Title unlocked!", "The trophy shelf grows!"],
  opened: ["Lock in.", "Read it twice, code it once.", "What's the brute force first?", "You've got this one."],
  "interview-start": ["Deep breaths. Talk it out.", "Impress him. I'm watching too.", "Think out loud!"],
  "run-ok": ["It runs! Ship it?", "Green output. Nice.", "Now check the edge cases."],
  "run-fail": ["Hmm. Read the error slowly.", "Debug mode. You've been here.", "It's always off-by-one."],
  poke: ["Back to the grind!", "One more node.", "Your rating misses you.", "Rematches don't win themselves."],
  skin: ["New look, same grind!", "Fresh drip acquired!", "How do I look?"],
};

function pick(key: string): string {
  const pool = LINES[key] ?? LINES.poke;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickAnim(pool: CoachAnim[]): CoachAnim {
  return pool[Math.floor(Math.random() * pool.length)];
}

function reaction(e: CoachEvent): { anim: CoachAnim; line: string } {
  switch (e.type) {
    case "solved":
      return e.clean
        ? { anim: pickAnim(["celebrate", "excited"]), line: pick("solved-clean") }
        : { anim: pickAnim(["happy", "laughing", "celebrate"]), line: pick("solved") };
    case "assisted":
      return { anim: pickAnim(["proud", "happy"]), line: pick("assisted") };
    case "failed":
      return { anim: pickAnim(["sad", "confused"]), line: pick("failed") };
    case "achievement": {
      const skin = skinForAchievementName(e.name);
      const extra = skin ? ` — new coach "${skin.name}" unlocked!` : "";
      return { anim: pickAnim(["excited", "surprised", "celebrate"]), line: `${pick("achievement")} ${e.name}${extra}` };
    }
    case "opened":
      return { anim: pickAnim(["thinking", "curious", "working"]), line: pick("opened") };
    case "interview-start":
      return { anim: "listening", line: pick("interview-start") };
    case "run-ok":
      return { anim: pickAnim(["proud", "happy"]), line: pick("run-ok") };
    case "run-fail":
      return { anim: pickAnim(["confused", "suspicious"]), line: pick("run-fail") };
    case "skin-equipped":
      return { anim: "playful", line: `${pick("skin")} (${e.name})` };
  }
}

const SLEEP_AFTER_MS = 120000;
const REACTION_MS = 4800;

export function Coach() {
  const [skinId, setSkinId] = useState(() => equippedSkin().id);
  // Remount the avatar per reaction so repeating the same animation replays it.
  const [state, setState] = useState<{ anim: CoachAnim; seq: number }>({ anim: "idle", seq: 0 });
  const [line, setLine] = useState<string | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CoachAvatar = useMemo(() => skinComponent(skinId), [skinId]);

  const say = (text: string) => {
    setLine(text);
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => setLine(null), 3600);
  };

  const armSleep = () => {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(() => {
      setState((s) => ({ anim: "sleeping", seq: s.seq + 1 }));
    }, SLEEP_AFTER_MS);
  };

  const react = (anim: CoachAnim) => {
    setState((s) => ({ anim, seq: s.seq + 1 }));
    if (idleTimer.current) clearTimeout(idleTimer.current);
    // Every animation loops, so short-lived moods fall back to idle on a timer.
    if (!SUSTAINED.has(anim)) {
      idleTimer.current = setTimeout(() => {
        setState((s) => ({ anim: "idle", seq: s.seq + 1 }));
      }, REACTION_MS);
    }
  };

  useEffect(() => {
    armSleep();
    const off = onCoach((e) => {
      if (e.type === "skin-equipped") setSkinId(equippedSkin().id);
      const r = reaction(e);
      react(r.anim);
      say(r.line);
      armSleep();
    });
    return () => {
      off();
      if (lineTimer.current) clearTimeout(lineTimer.current);
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5">
      <AnimatePresence>
        {line && (
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: -2 }}
            exit={{ y: 8, opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="max-w-[210px] border-4 border-black bg-white px-3 py-1.5 text-[11px] font-black uppercase leading-snug shadow-neo-sm"
          >
            {line}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="Your coach"
        whileHover={{ scale: 1.12, rotate: -4, y: -4 }}
        whileTap={{ scale: 0.88, rotate: 4 }}
        onClick={() => {
          react(pickAnim(["playful", "waking", "curious"]));
          say(pick("poke"));
          armSleep();
        }}
        className="pointer-events-auto grid place-items-center overflow-visible border-4 border-black bg-neo-bg shadow-neo"
      >
        <motion.div key={`move-${state.seq}`} animate={moveFor(state.anim)}>
          <CoachAvatar
            key={`${skinId}-${state.seq}`}
            defaultAnimation={state.anim}
            size={92}
            ariaLabel="Coach avatar"
          />
        </motion.div>
      </motion.button>
    </div>
  );
}

// Small static preview used by the locker in Analytics.
export function CoachPreview({ skinId, size = 64 }: { skinId: string; size?: number }) {
  const Comp = useMemo(() => skinComponent(skinId), [skinId]);
  return <Comp defaultAnimation="idle" size={size} ariaLabel={`${skinId} coach preview`} />;
}
