// Juice engine: imperative, fire-and-forget game-feel effects drawn on one
// fixed overlay (<JuiceLayer/>). Any component can call these with screen
// coordinates — no React state, no re-renders. Everything no-ops when the
// player (or their OS) asked for reduced motion.
const REDUCE_KEY = "leetgraph.reduceFx";
const INK = "#000";
export const NEO = ["#FF6B6B", "#FFD93D", "#C4B5FD", "#4ADE80", "#4D96FF", "#FF6FB5", "#FF9F45"];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let layer: HTMLDivElement | null = null;
let raf = 0;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number; // seconds left
  max: number;
  shape: "square" | "circle" | "shard";
  gravity: number;
  drag: number;
}
const particles: Particle[] = [];

// ---------------- settings ----------------

const listeners = new Set<() => void>();
export function reduceFx(): boolean {
  try {
    if (localStorage.getItem(REDUCE_KEY) === "1") return true;
  } catch {
    /* storage blocked */
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
export function setReduceFx(on: boolean) {
  try {
    if (on) localStorage.setItem(REDUCE_KEY, "1");
    else localStorage.removeItem(REDUCE_KEY);
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}
export function onReduceFxChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---------------- mounting ----------------

export function mountJuice(c: HTMLCanvasElement, l: HTMLDivElement) {
  canvas = c;
  layer = l;
  ctx = c.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  return () => {
    window.removeEventListener("resize", resize);
    cancelAnimationFrame(raf);
    raf = 0;
    canvas = null;
    ctx = null;
    layer = null;
  };
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------- particle loop ----------------

let last = 0;
function tick(t: number) {
  if (!ctx || !canvas) return;
  const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
  last = t;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vx *= 1 - p.drag * dt;
    p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const k = p.life / p.max;
    const s = p.size * (0.4 + 0.6 * k);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (p.shape === "circle") ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
    else if (p.shape === "shard") {
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s / 3, s / 2);
      ctx.lineTo(-s / 3, s / 2);
      ctx.closePath();
    } else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  if (particles.length > 0) raf = requestAnimationFrame(tick);
  else {
    raf = 0;
    last = 0;
  }
}

function kick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

export interface BurstOpts {
  colors?: string[];
  count?: number;
  speed?: number; // px/s
  spread?: number; // radians (2π = ring)
  angle?: number; // center direction, radians (−π/2 = up)
  gravity?: number;
  size?: number;
  life?: number;
  shape?: Particle["shape"] | "mix";
}

// Confetti / debris burst at a screen point.
export function burst(x: number, y: number, o: BurstOpts = {}) {
  if (reduceFx() || !ctx) return;
  const {
    colors = NEO,
    count = 28,
    speed = 520,
    spread = Math.PI * 2,
    angle = -Math.PI / 2,
    gravity = 900,
    size = 12,
    life = 1.1,
    shape = "mix",
  } = o;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.35 + Math.random() * 0.75);
    const shp: Particle["shape"] =
      shape === "mix" ? (["square", "circle", "shard"] as const)[Math.floor(Math.random() * 3)] : shape;
    const l = life * (0.6 + Math.random() * 0.6);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      size: size * (0.6 + Math.random() * 0.8),
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 14,
      color: colors[i % colors.length],
      life: l,
      max: l,
      shape: shp,
      gravity,
      drag: 1.6,
    });
  }
  kick();
}

// Full-width confetti rain from the top edge.
export function confettiRain(count = 90) {
  if (reduceFx() || !ctx) return;
  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    const l = 2 + Math.random() * 1.4;
    particles.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 120,
      vy: 120 + Math.random() * 260,
      size: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 10,
      color: NEO[i % NEO.length],
      life: l,
      max: l,
      shape: Math.random() > 0.5 ? "square" : "circle",
      gravity: 260,
      drag: 0.4,
    });
  }
  kick();
}

// ---------------- DOM effects ----------------

function el(tag: string, css: Partial<CSSStyleDeclaration>, html = ""): HTMLElement {
  const e = document.createElement(tag);
  Object.assign(e.style, css);
  e.innerHTML = html;
  layer?.appendChild(e);
  return e;
}

function done(anim: Animation, e: HTMLElement) {
  anim.onfinish = () => e.remove();
  anim.oncancel = () => e.remove();
}

// "+32" style popup text that floats up and fades.
export function floatText(
  x: number,
  y: number,
  text: string,
  o: { bg?: string; color?: string; size?: number; delay?: number; rise?: number } = {}
) {
  if (!layer) return;
  const { bg = "#FFD93D", color = "#000", size = 16, delay = 0, rise = 70 } = o;
  const e = el(
    "div",
    {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      padding: "2px 8px",
      background: bg,
      color,
      border: "3px solid #000",
      boxShadow: "3px 3px 0 0 #000",
      font: `900 ${size}px "Space Grotesk", system-ui, sans-serif`,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      transform: "translate(-50%, -50%)",
      opacity: "0",
    },
    text
  );
  if (reduceFx()) {
    done(e.animate([{ opacity: 1 }, { opacity: 1 }, { opacity: 0 }], { duration: 1100, delay }), e);
    return;
  }
  const rot = (Math.random() - 0.5) * 12;
  done(
    e.animate(
      [
        { opacity: 0, transform: `translate(-50%, -50%) scale(0.3) rotate(${rot}deg)` },
        { opacity: 1, transform: `translate(-50%, -80%) scale(1.25) rotate(${rot}deg)`, offset: 0.18 },
        { opacity: 1, transform: `translate(-50%, -90%) scale(1) rotate(${rot / 2}deg)`, offset: 0.35 },
        { opacity: 0, transform: `translate(-50%, calc(-90% - ${rise}px)) scale(0.9) rotate(0deg)` },
      ],
      { duration: 1300, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    ),
    e
  );
}

// Expanding shockwave ring.
export function ring(x: number, y: number, color = "#000", size = 160) {
  if (reduceFx() || !layer) return;
  const e = el("div", {
    position: "fixed",
    left: `${x}px`,
    top: `${y}px`,
    width: `${size}px`,
    height: `${size}px`,
    border: `6px solid ${color}`,
    borderRadius: "50%",
    pointerEvents: "none",
    transform: "translate(-50%, -50%) scale(0)",
  });
  done(
    e.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.1)", opacity: 1, borderWidth: "10px" },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 0, borderWidth: "1px" },
      ],
      { duration: 520, easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" }
    ),
    e
  );
}

// Screen-edge color flash (vignette).
export function flash(color = "#fff", strength = 0.55, ms = 380) {
  if (reduceFx() || !layer) return;
  const e = el("div", {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    background: `radial-gradient(ellipse at center, transparent 35%, ${color} 130%)`,
    opacity: "0",
  });
  done(e.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: "ease-out" }), e);
}

// Full-screen solid blink (crit / hitstop).
export function blink(color = "#fff", strength = 0.7) {
  if (reduceFx() || !layer) return;
  const e = el("div", { position: "fixed", inset: "0", pointerEvents: "none", background: color, opacity: "0" });
  done(e.animate([{ opacity: strength }, { opacity: 0 }], { duration: 180, easing: "ease-out" }), e);
}

function center(target: Element | { x: number; y: number }): { x: number; y: number } {
  if ("getBoundingClientRect" in target) {
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return target;
}

// Scale punch on any element (counter pop when loot lands).
export function punch(target: Element | null, scale = 1.25) {
  if (!target || reduceFx()) return;
  (target as HTMLElement).animate(
    [{ transform: "scale(1)" }, { transform: `scale(${scale}) rotate(-3deg)` }, { transform: "scale(1)" }],
    { duration: 320, easing: "cubic-bezier(.3,1.6,.5,1)" }
  );
}

// Loot tokens that arc from a point into a HUD element (coins → wallet).
export function flyTo(
  from: Element | { x: number; y: number },
  toSelector: string,
  o: { html: string; bg?: string; count?: number; onArrive?: () => void } = { html: "" }
) {
  const target = document.querySelector(toSelector);
  if (!layer || !target) {
    o.onArrive?.();
    return;
  }
  if (reduceFx()) {
    o.onArrive?.();
    return;
  }
  const a = center(from);
  const b = center(target);
  const n = Math.max(1, Math.min(o.count ?? 5, 10));
  let arrived = 0;
  for (let i = 0; i < n; i++) {
    const e = el(
      "div",
      {
        position: "fixed",
        left: "0px",
        top: "0px",
        width: "26px",
        height: "26px",
        display: "grid",
        placeItems: "center",
        background: o.bg ?? "#FFD93D",
        border: "3px solid #000",
        boxShadow: "2px 2px 0 0 #000",
        borderRadius: "50%",
        font: '900 12px "Space Grotesk", sans-serif',
        pointerEvents: "none",
      },
      o.html
    );
    const sx = a.x + (Math.random() - 0.5) * 60;
    const sy = a.y + (Math.random() - 0.5) * 40;
    const mx = (sx + b.x) / 2 + (Math.random() - 0.5) * 160;
    const my = Math.min(sy, b.y) - 80 - Math.random() * 80;
    const anim = e.animate(
      [
        { transform: `translate(${a.x - 13}px, ${a.y - 13}px) scale(0.2)` },
        { transform: `translate(${sx - 13}px, ${sy - 13}px) scale(1.2)`, offset: 0.18 },
        { transform: `translate(${mx - 13}px, ${my - 13}px) scale(1)`, offset: 0.55 },
        { transform: `translate(${b.x - 13}px, ${b.y - 13}px) scale(0.5)` },
      ],
      { duration: 780 + i * 70, delay: i * 55, easing: "cubic-bezier(.5,0,.6,1)", fill: "forwards" }
    );
    anim.onfinish = () => {
      e.remove();
      arrived++;
      punch(target, 1.18);
      if (arrived === n) o.onArrive?.();
    };
    anim.oncancel = () => e.remove();
  }
}

// ---------------- camera ----------------

let shakeTarget: HTMLElement | null = null;
export function registerShakeTarget(e: HTMLElement | null) {
  shakeTarget = e;
}

export function shake(intensity = 1) {
  if (reduceFx()) return;
  const t = shakeTarget ?? document.getElementById("root");
  if (!t) return;
  const d = 10 * intensity;
  const frames: Keyframe[] = [];
  for (let i = 0; i < 8; i++) {
    const k = 1 - i / 8;
    frames.push({
      transform: `translate(${(Math.random() - 0.5) * 2 * d * k}px, ${(Math.random() - 0.5) * 2 * d * k}px) rotate(${
        (Math.random() - 0.5) * 1.2 * intensity * k
      }deg)`,
    });
  }
  frames.push({ transform: "translate(0,0) rotate(0)" });
  t.animate(frames, { duration: 380 + 120 * intensity, easing: "linear" });
}

// Brief freeze-frame before a big payoff.
export function hitstop(ms = 80): Promise<void> {
  if (reduceFx()) return Promise.resolve();
  const t = shakeTarget ?? document.getElementById("root");
  t?.animate([{ filter: "contrast(1.4) saturate(1.4)" }, { filter: "none" }], { duration: ms + 60 });
  return new Promise((r) => setTimeout(r, ms));
}

// Screen point of a DOM element's center (convenience for callers).
export function pointOf(target: Element | null): { x: number; y: number } {
  if (!target) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return center(target);
}
