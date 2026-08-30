import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { FaGoogle, FaEnvelope, FaBolt, FaRightFromBracket } from "react-icons/fa6";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { hydrateFromCloud, startCloudPersistence, clearLocalMirror } from "../state/sync";

type Phase = "loading" | "signed-out" | "ready";

const AuthContext = createContext<User | null>(null);
export function useAuthUser(): User | null {
  return useContext(AuthContext);
}

export function signOut() {
  void supabase?.auth.signOut();
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const google = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    }
  };

  const magicLink = async () => {
    if (!supabase || !email.trim()) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="grid min-h-full place-items-center bg-neo-bg bg-grid p-5 font-display text-neo-ink">
      <motion.div
        initial={{ y: 30, opacity: 0, rotate: -2 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="w-full max-w-sm border-4 border-black bg-white shadow-neo-lg"
      >
        <div className="flex items-center gap-3 border-b-4 border-black bg-neo-accent px-5 py-4">
          <motion.img
            src="/logo.svg"
            alt="LeetGraph logo"
            initial={{ rotate: -12, scale: 0 }}
            animate={{ rotate: -4, scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
            className="h-12 w-12 shrink-0"
          />
          <div>
            <span className="text-2xl font-black uppercase tracking-tight text-white">LEET</span>
            <span className="text-2xl font-black uppercase tracking-tight">GRAPH</span>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-black/80">
              Sign in — your rating, streaks and rematches follow you everywhere.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <motion.button
            whileHover={{ scale: 1.03, rotate: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => void google()}
            className="flex items-center justify-center gap-2 border-4 border-black bg-white px-4 py-3 text-sm font-black uppercase shadow-neo-sm transition-colors hover:bg-neo-secondary"
          >
            <FaGoogle /> Continue with Google
          </motion.button>

          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-black/50">
            <span className="h-0.5 flex-1 bg-black/20" /> or <span className="h-0.5 flex-1 bg-black/20" />
          </div>

          {status === "sent" ? (
            <div className="border-4 border-black bg-neo-ok p-3 text-center text-xs font-black uppercase">
              <FaEnvelope className="mr-1 inline" /> Magic link sent — check your inbox!
            </div>
          ) : (
            <>
              <input
                type="email"
                className="neo-input !py-2.5 text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void magicLink()}
              />
              <motion.button
                whileHover={{ scale: 1.03, rotate: 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => void magicLink()}
                disabled={status === "sending" || !email.trim()}
                className="flex items-center justify-center gap-2 border-4 border-black bg-neo-secondary px-4 py-3 text-sm font-black uppercase shadow-neo-sm disabled:opacity-50"
              >
                <FaEnvelope /> {status === "sending" ? "Sending…" : "Email me a magic link"}
              </motion.button>
            </>
          )}

          {status === "error" && (
            <p className="border-2 border-black bg-neo-accent px-2 py-1 text-[11px] font-black uppercase text-white">
              {error}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="grid min-h-full place-items-center bg-neo-bg bg-grid font-display">
      <motion.div
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="flex items-center gap-2 border-4 border-black bg-neo-secondary px-6 py-4 text-sm font-black uppercase shadow-neo"
      >
        <FaBolt className="text-neo-accent" /> {label}
      </motion.div>
    </div>
  );
}

// Small floating account chip (email + sign out) shown while signed in.
function AccountChip({ user }: { user: User }) {
  return (
    <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-40">
      <motion.button
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        whileHover={{ y: -2, rotate: -1 }}
        whileTap={{ scale: 0.94 }}
        onClick={signOut}
        title="Sign out"
        className="pointer-events-auto flex items-center gap-2 border-4 border-black bg-white px-2.5 py-1.5 text-[10px] font-black uppercase shadow-neo-sm hover:bg-neo-accent hover:text-white"
      >
        <span className="max-w-[160px] truncate normal-case">{user.email}</span>
        <FaRightFromBracket />
      </motion.button>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  // Without Supabase creds the app runs local-only (dev mode).
  const [phase, setPhase] = useState<Phase>(supabase ? "loading" : "ready");
  const [user, setUser] = useState<User | null>(null);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const activate = async (u: User) => {
      if (hydratedFor.current === u.id) return;
      hydratedFor.current = u.id;
      setPhase("loading");
      try {
        await hydrateFromCloud(u.id);
      } catch (e) {
        console.error("[sync] hydrate failed — running on local mirror:", e);
      }
      startCloudPersistence(u.id);
      setUser(u);
      setPhase("ready");
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void activate(data.session.user);
      else setPhase("signed-out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        void activate(session.user);
      } else if (event === "SIGNED_OUT") {
        clearLocalMirror();
        hydratedFor.current = null;
        setUser(null);
        // Full reload so every derived system re-reads the empty mirror.
        window.location.replace("/");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (phase === "loading") return <LoadingScreen label="Syncing your run…" />;
  if (phase === "signed-out") return <LoginScreen />;
  return (
    <AuthContext.Provider value={user}>
      {children}
      {user && <AccountChip user={user} />}
    </AuthContext.Provider>
  );
}
