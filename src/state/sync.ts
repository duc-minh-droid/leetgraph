// Cloud persistence (Supabase). The app's derived systems all read the
// localStorage mirror synchronously, so the strategy is:
//   1. on sign-in: pull everything, merge in any pre-auth local history
//      (pushing it up), and rewrite the local mirror
//   2. afterwards: every local write emits a "leetgraph:persist" event that
//      is pushed to Supabase in the background
//   3. on sign-out: wipe the mirror so accounts never bleed into each other
import { supabase } from "../lib/supabase";
import { getAllAttempts, replaceAttempts, type Attempt, type AttemptLog } from "./attempts";
import { listInterviews, replaceInterviews, type InterviewRecord } from "./interviews";
import { setTitleLocal } from "./achievements";
import { setSkinLocal } from "./coachSkins";

type PersistDetail =
  | { kind: "attempt"; slug: string; attempt: Attempt }
  | { kind: "interview"; rec: InterviewRecord }
  | { kind: "profile"; title?: string; coachSkin?: string };

const MIRROR_KEYS = [
  "leegraph.attempts",
  "leetgraph.interviews",
  "leetgraph.title",
  "leetgraph.coachSkin",
];

export function clearLocalMirror() {
  for (const k of MIRROR_KEYS) localStorage.removeItem(k);
}

export async function hydrateFromCloud(userId: string): Promise<void> {
  if (!supabase) return;

  const [attemptsRes, interviewsRes, profileRes] = await Promise.all([
    supabase.from("attempts").select("slug, at, payload").order("at"),
    supabase.from("interviews").select("at, payload").order("at"),
    supabase.from("profiles").select("title, coach_skin").maybeSingle(),
  ]);
  if (attemptsRes.error) throw attemptsRes.error;
  if (interviewsRes.error) throw interviewsRes.error;

  // ---- attempts: merge server + any pre-auth local history ----
  const serverRows = attemptsRes.data ?? [];
  const serverKeys = new Set(serverRows.map((r) => `${r.slug}|${r.at}`));
  const localLog = getAllAttempts();
  const toPush: { user_id: string; slug: string; at: number; payload: Attempt }[] = [];
  for (const [slug, list] of Object.entries(localLog)) {
    for (const a of list) {
      if (!serverKeys.has(`${slug}|${a.at}`)) {
        toPush.push({ user_id: userId, slug, at: a.at, payload: a });
      }
    }
  }
  if (toPush.length) {
    const { error } = await supabase
      .from("attempts")
      .upsert(toPush, { onConflict: "user_id,slug,at" });
    if (error) console.error("[sync] failed to upload local history:", error);
  }

  const merged: AttemptLog = structuredClone(localLog);
  for (const r of serverRows) {
    const list = (merged[r.slug] ??= []);
    if (!list.some((a) => a.at === r.at)) list.push(r.payload as Attempt);
  }
  for (const list of Object.values(merged)) list.sort((a, b) => a.at - b.at);
  replaceAttempts(merged);

  // ---- interviews: same merge ----
  const srvInterviews = (interviewsRes.data ?? []).map((r) => r.payload as InterviewRecord);
  const srvAts = new Set(srvInterviews.map((r) => r.at));
  const localInterviews = listInterviews();
  const interviewPush = localInterviews.filter((r) => !srvAts.has(r.at));
  if (interviewPush.length) {
    const { error } = await supabase.from("interviews").upsert(
      interviewPush.map((rec) => ({ user_id: userId, at: rec.at, payload: rec })),
      { onConflict: "user_id,at" }
    );
    if (error) console.error("[sync] failed to upload local interviews:", error);
  }
  const allInterviews = [...srvInterviews, ...interviewPush].sort((a, b) => a.at - b.at);
  replaceInterviews(allInterviews);

  // ---- profile: server wins when set, otherwise push local prefs up ----
  const profile = profileRes.data;
  const localTitle = localStorage.getItem("leetgraph.title");
  const localSkin = localStorage.getItem("leetgraph.coachSkin");
  setTitleLocal(profile?.title ?? localTitle);
  setSkinLocal(profile?.coach_skin ?? localSkin);
  if (!profile?.title || !profile?.coach_skin) {
    await supabase.from("profiles").upsert({
      user_id: userId,
      title: profile?.title ?? localTitle,
      coach_skin: profile?.coach_skin ?? localSkin,
    });
  }
}

let listenerAttached = false;

export function startCloudPersistence(userId: string) {
  if (!supabase || listenerAttached) return;
  listenerAttached = true;

  window.addEventListener("leetgraph:persist", (ev) => {
    const d = (ev as CustomEvent<PersistDetail>).detail;
    void pushDetail(userId, d);
  });
}

async function pushDetail(userId: string, d: PersistDetail) {
  if (!supabase) return;
  try {
    if (d.kind === "attempt") {
      const { error } = await supabase
        .from("attempts")
        .upsert(
          { user_id: userId, slug: d.slug, at: d.attempt.at, payload: d.attempt },
          { onConflict: "user_id,slug,at" }
        );
      if (error) throw error;
    } else if (d.kind === "interview") {
      const { error } = await supabase
        .from("interviews")
        .upsert({ user_id: userId, at: d.rec.at, payload: d.rec }, { onConflict: "user_id,at" });
      if (error) throw error;
    } else {
      const patch: Record<string, unknown> = { user_id: userId };
      if (d.title !== undefined) patch.title = d.title;
      if (d.coachSkin !== undefined) patch.coach_skin = d.coachSkin;
      const { error } = await supabase.from("profiles").upsert(patch);
      if (error) throw error;
    }
  } catch (e) {
    // Data is still in the local mirror; it re-uploads on next sign-in merge.
    console.error("[sync] cloud write failed (kept locally):", e);
  }
}
