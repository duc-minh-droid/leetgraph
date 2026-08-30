// Sound layer (react-sounds / howler): one-shot SFX for instant feedback on
// every interaction, plus rank-gated ambient loops (each promotion unlocks a
// new background soundscape).
import { playSound, getCDNUrl, type LibrarySoundName } from "react-sounds";
import { Howl } from "howler";
import manifest from "react-sounds/dist/manifest.json";

// ---------------- one-shot SFX ----------------

export const SFX = {
  click: "ui/button_soft",
  tab: "ui/tab_open",
  toggleOn: "ui/toggle_on",
  toggleOff: "ui/toggle_off",
  solved: "notification/success",
  assisted: "ui/success_chime",
  failed: "game/miss",
  crit: "arcade/coin_bling",
  levelUp: "arcade/level_up",
  rankUp: "arcade/power_up",
  rankDown: "arcade/level_down",
  promoLost: "arcade/power_down",
  chestAppear: "game/portal_opening",
  chestTake: "arcade/upgrade",
  coinFlip: "arcade/coin",
  potion: "game/coin",
  achievement: "notification/completed",
  quest: "ui/success_bling",
  boss: "system/boot_up",
  curse: "ui/buzz_deep",
  error: "notification/error",
} as const satisfies Record<string, LibrarySoundName>;

export type SfxKey = keyof typeof SFX;

export function sfx(key: SfxKey, volume = 0.5) {
  void playSound(SFX[key], { volume }).catch(() => {
    /* autoplay-blocked or offline — never break the app over a sound */
  });
}

// Soft click on every button/link press, app-wide, via one capture listener.
let clickInit = false;
export function initClickSfx() {
  if (clickInit) return;
  clickInit = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, a, [role='button'], input[type='checkbox'], select")) {
        sfx("click", 0.22);
      }
    },
    { capture: true }
  );
}

// ---------------- rank-gated ambient loops ----------------

export interface AmbientDef {
  sound: string; // manifest key
  label: string;
  rankIdx: number; // rank index required (see state/rating RANKS)
}

// Each promotion unlocks the next soundscape.
export const AMBIENTS: AmbientDef[] = [
  { sound: "ambient/campfire", label: "Campfire", rankIdx: 1 }, // Silver
  { sound: "ambient/rain", label: "Rain", rankIdx: 2 }, // Gold
  { sound: "ambient/water_stream", label: "Stream", rankIdx: 3 }, // Platinum
  { sound: "ambient/wind", label: "Wind", rankIdx: 4 }, // Diamond
  { sound: "ambient/heartbeat", label: "Heartbeat", rankIdx: 5 }, // Master
  { sound: "game/void", label: "The Void", rankIdx: 6 }, // Grandmaster
];

const AMBIENT_KEY = "leetgraph.ambient";
let ambientHowl: Howl | null = null;
let ambientName: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function onAmbientChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function currentAmbient(): string | null {
  return ambientName;
}

export function playAmbient(sound: string) {
  stopAmbient(false);
  const entry = (manifest as { sounds: Record<string, { src: string }> }).sounds[sound];
  if (!entry) return;
  ambientHowl = new Howl({
    src: [`${getCDNUrl()}/${entry.src}`],
    loop: true,
    volume: 0.3,
    html5: true,
  });
  ambientHowl.play();
  ambientName = sound;
  localStorage.setItem(AMBIENT_KEY, sound);
  notify();
}

export function stopAmbient(clearChoice = true) {
  ambientHowl?.stop();
  ambientHowl?.unload();
  ambientHowl = null;
  ambientName = null;
  if (clearChoice) localStorage.removeItem(AMBIENT_KEY);
  notify();
}

// Resume the saved ambient after the first user gesture (autoplay policy).
let resumeInit = false;
export function initAmbientResume() {
  if (resumeInit) return;
  resumeInit = true;
  const saved = localStorage.getItem(AMBIENT_KEY);
  if (!saved) return;
  const handler = () => {
    if (!ambientName && localStorage.getItem(AMBIENT_KEY)) {
      playAmbient(localStorage.getItem(AMBIENT_KEY)!);
    }
    document.removeEventListener("pointerdown", handler);
  };
  document.addEventListener("pointerdown", handler, { once: true });
}
