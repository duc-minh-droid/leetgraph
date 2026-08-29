import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhone,
  FaPhoneSlash,
  FaUserTie,
  FaChalkboard,
  FaFlagCheckered,
} from "react-icons/fa6";

export interface TranscriptLine {
  role: "user" | "agent";
  message: string;
}

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function MicDock({
  status,
  isSpeaking,
  isMuted,
  elapsed,
  transcript,
  canStart,
  agentMissing,
  statementPending,
  error,
  sharingBoard,
  hasSessionEnded,
  onStart,
  onEnd,
  onToggleMute,
  onShareBoard,
  onLogAttempt,
}: {
  status: string;
  isSpeaking: boolean;
  isMuted: boolean;
  elapsed: number;
  transcript: TranscriptLine[];
  canStart: boolean;
  agentMissing: boolean;
  statementPending: boolean;
  error: string | null;
  sharingBoard: boolean;
  hasSessionEnded: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onShareBoard: () => void;
  onLogAttempt: () => void;
}) {
  const live = status === "connected";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript]);

  return (
    <div className="flex items-stretch gap-3 border-4 border-black bg-white p-2.5 shadow-neo">
      {/* Interviewer avatar */}
      <div className="flex flex-col items-center justify-center gap-1 px-1">
        <motion.div
          animate={
            isSpeaking && live
              ? { scale: [1, 1.12, 1], rotate: [-2, 2, -2] }
              : { scale: 1, rotate: -2 }
          }
          transition={isSpeaking && live ? { duration: 0.7, repeat: Infinity } : {}}
          className={`grid h-12 w-12 place-items-center border-4 border-black shadow-neo-sm ${
            live ? (isSpeaking ? "bg-neo-accent" : "bg-neo-ok") : "bg-neo-bg"
          }`}
        >
          <FaUserTie className="text-xl" />
        </motion.div>
        <span className="text-[9px] font-black uppercase">
          {!live ? "offline" : isSpeaking ? "speaking" : "listening"}
        </span>
      </div>

      {/* Transcript strip */}
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-y-auto border-2 border-black bg-neo-bg p-2"
        style={{ maxHeight: 84 }}
      >
        {error && (
          <p className="mb-1 border-2 border-black bg-neo-accent px-1.5 py-0.5 text-[11px] font-black uppercase">
            Error: {error}
          </p>
        )}
        {transcript.length === 0 ? (
          <p className="text-[11px] font-bold uppercase text-black/50">
            {agentMissing
              ? "Agent not configured — set VITE_ELEVENLABS_AGENT_ID in .env.local (npx tsx scripts/createInterviewAgent.ts), then restart the dev server."
              : statementPending
                ? "Waiting for the problem statement to load — Start unlocks when it's ready."
                : live
                  ? "Tap the mic button and start talking. Tap again when you're done."
                  : "Start the interview to talk to your interviewer. Grant mic access when asked."}
          </p>
        ) : (
          transcript.map((l, i) => (
            <p key={i} className="text-[11px] font-bold leading-snug">
              <span className={`mr-1 uppercase ${l.role === "agent" ? "text-neo-accent" : "text-black/50"}`}>
                {l.role === "agent" ? "Interviewer" : "You"}:
              </span>
              {l.message}
            </p>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <span className={`border-2 border-black px-2 py-1 text-xs font-black tabular-nums ${live ? "bg-neo-secondary" : "bg-neo-bg"}`}>
          {fmtClock(elapsed)}
        </span>

        {live && (
          <>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onShareBoard}
              disabled={sharingBoard}
              title="Show the whiteboard to the interviewer now"
              className="grid h-11 w-11 place-items-center border-4 border-black bg-white shadow-neo-sm transition-colors hover:bg-neo-muted disabled:opacity-50"
            >
              <motion.span animate={sharingBoard ? { rotate: 360 } : {}} transition={sharingBoard ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
                <FaChalkboard />
              </motion.span>
            </motion.button>

            {/* Push-to-talk: mic starts closed; tap to open, tap again when done. */}
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={onToggleMute}
              className={`relative flex items-center gap-2 border-4 border-black px-4 py-2.5 text-sm font-black uppercase shadow-neo-sm transition-colors ${
                isMuted ? "bg-neo-secondary hover:bg-neo-ok" : "bg-neo-ok"
              }`}
            >
              {!isMuted && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1.5 border-4 border-neo-ok"
                  animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {isMuted ? (
                <>
                  <FaMicrophoneSlash /> Tap to talk
                </>
              ) : (
                <>
                  <motion.span
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <FaMicrophone />
                  </motion.span>
                  Mic on
                </>
              )}
            </motion.button>
          </>
        )}

        {!live && hasSessionEnded && (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onLogAttempt}
            className="flex items-center gap-2 border-4 border-black bg-neo-secondary px-3 py-2 text-xs font-black uppercase shadow-neo-sm"
          >
            <FaFlagCheckered /> Log attempt
          </motion.button>
        )}

        {live ? (
          <motion.button
            whileHover={{ scale: 1.06, rotate: 1 }}
            whileTap={{ scale: 0.93 }}
            onClick={onEnd}
            className="flex items-center gap-2 border-4 border-black bg-neo-accent px-4 py-2.5 text-sm font-black uppercase shadow-neo-sm"
          >
            <FaPhoneSlash /> End
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.06, rotate: -1 }}
            whileTap={{ scale: 0.93 }}
            onClick={onStart}
            disabled={!canStart || status === "connecting"}
            className="flex items-center gap-2 border-4 border-black bg-neo-ok px-4 py-2.5 text-sm font-black uppercase shadow-neo-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaPhone /> {status === "connecting" ? "Connecting…" : "Start interview"}
          </motion.button>
        )}
      </div>
    </div>
  );
}
