// 8-bit ambient weather per map, drawn on a chunky pixel grid:
//   amazon → rain · google → meteor strikes (with explosions)
//   meta → twinkles + shooting stars · apple → drifting fog
import { useEffect, useRef } from "react";

const PX = 4; // logical pixel size — everything snaps to this grid

interface Drop { x: number; y: number; v: number }
interface Meteor { x: number; y: number; vx: number; vy: number; targetY: number }
interface Boom { x: number; y: number; t: number; parts: { dx: number; dy: number; vx: number; vy: number }[] }
interface Star { x: number; y: number; phase: number; speed: number; color: string }
interface Shooter { x: number; y: number; vx: number; vy: number; life: number }
interface Cloud { x: number; y: number; w: number; v: number; alpha: number }

export function MapWeather({ mapId }: { mapId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const resize = () => {
      const p = canvas.parentElement;
      if (!p) return;
      canvas.width = p.clientWidth;
      canvas.height = p.clientHeight;
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const snap = (n: number) => Math.floor(n / PX) * PX;
    const px = (x: number, y: number, w: number, h: number, color: string, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(snap(x), snap(y), w * PX, h * PX);
      ctx.globalAlpha = 1;
    };

    // ---- per-map state ----
    const W = () => canvas.width;
    const H = () => canvas.height;
    const drops: Drop[] = Array.from({ length: 70 }, () => ({
      x: Math.random() * 4000, y: Math.random() * 2000, v: 5 + Math.random() * 6,
    }));
    let meteor: Meteor | null = null;
    let boom: Boom | null = null;
    let nextMeteor = performance.now() + 3000 + Math.random() * 5000;
    const stars: Star[] = Array.from({ length: 26 }, () => ({
      x: Math.random() * 4000, y: Math.random() * 2000, phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2, color: Math.random() < 0.5 ? "#C4B5FD" : "#FFD93D",
    }));
    let shooter: Shooter | null = null;
    let nextShooter = performance.now() + 2000 + Math.random() * 4000;
    const clouds: Cloud[] = Array.from({ length: 7 }, (_, i) => ({
      x: Math.random() * 4000, y: (i / 7) * 1600 + Math.random() * 120,
      w: 24 + Math.floor(Math.random() * 28), v: 0.15 + Math.random() * 0.35,
      alpha: 0.10 + Math.random() * 0.12,
    }));

    const tick = (now: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, W(), H());

      if (mapId === "amazon") {
        for (const d of drops) {
          d.y += d.v;
          d.x -= d.v * 0.25;
          if (d.y > H()) { d.y = -20; d.x = Math.random() * (W() + 200); }
          px(d.x % (W() + 200), d.y, 1, 3, "#4D96FF", 0.4);
        }
      } else if (mapId === "google") {
        if (!meteor && !boom && now > nextMeteor) {
          const x = W() * (0.15 + Math.random() * 0.7);
          meteor = { x: x + 260, y: -40, vx: -3.4, vy: 4.6, targetY: H() * (0.45 + Math.random() * 0.35) };
        }
        if (meteor) {
          meteor.x += meteor.vx;
          meteor.y += meteor.vy;
          // trail
          for (let i = 0; i < 5; i++) {
            px(meteor.x - meteor.vx * i * 2, meteor.y - meteor.vy * i * 2, 2 - (i > 2 ? 1 : 0), 2 - (i > 2 ? 1 : 0), i < 2 ? "#FFD93D" : "#FF6B6B", 0.85 - i * 0.15);
          }
          px(meteor.x, meteor.y, 3, 3, "#FF6B6B");
          px(meteor.x + PX, meteor.y + PX, 1, 1, "#FFFDF5", 0.9);
          if (meteor.y >= meteor.targetY) {
            boom = {
              x: meteor.x, y: meteor.y, t: 0,
              parts: Array.from({ length: 22 }, () => {
                const a = Math.random() * Math.PI * 2;
                const s = 2 + Math.random() * 5;
                return { dx: 0, dy: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2 };
              }),
            };
            meteor = null;
          }
        }
        if (boom) {
          boom.t++;
          const fade = 1 - boom.t / 45;
          if (boom.t < 8) px(boom.x - 4 * PX, boom.y - 4 * PX, 9, 9, "#FFD93D", 0.5 * fade + 0.3);
          for (const p of boom.parts) {
            p.vy += 0.18;
            p.dx += p.vx;
            p.dy += p.vy;
            px(boom.x + p.dx, boom.y + p.dy, 1, 1, boom.t % 2 ? "#FF6B6B" : "#FFD93D", Math.max(0, fade));
          }
          if (boom.t > 45) {
            boom = null;
            nextMeteor = now + 5000 + Math.random() * 8000;
          }
        }
      } else if (mapId === "meta") {
        for (const s of stars) {
          const a = (Math.sin(now / 1000 * s.speed + s.phase) + 1) / 2;
          if (a > 0.35) {
            const x = s.x % W();
            const y = s.y % H();
            px(x, y, 1, 1, s.color, a * 0.75);
            if (a > 0.8) { // sparkle cross at peak
              px(x - PX, y, 1, 1, s.color, a * 0.4);
              px(x + PX, y, 1, 1, s.color, a * 0.4);
              px(x, y - PX, 1, 1, s.color, a * 0.4);
              px(x, y + PX, 1, 1, s.color, a * 0.4);
            }
          }
        }
        if (!shooter && now > nextShooter) {
          shooter = { x: -30, y: H() * (0.1 + Math.random() * 0.5), vx: 9 + Math.random() * 5, vy: 1.6, life: 0 };
        }
        if (shooter) {
          shooter.x += shooter.vx;
          shooter.y += shooter.vy;
          shooter.life++;
          for (let i = 0; i < 7; i++) {
            px(shooter.x - shooter.vx * i * 1.4, shooter.y - shooter.vy * i * 1.4, 1, 1, i < 2 ? "#FFFDF5" : "#FFD93D", 0.9 - i * 0.12);
          }
          if (shooter.x > W() + 60) {
            shooter = null;
            nextShooter = now + 3000 + Math.random() * 6000;
          }
        }
      } else if (mapId === "apple") {
        for (const c of clouds) {
          c.x += c.v;
          const x = (c.x % (W() + c.w * PX * 2)) - c.w * PX;
          const y = c.y % H();
          // blobby 8-bit cloud: three stacked rows
          px(x + 4 * PX, y, c.w - 8, 2, "#9aa0a6", c.alpha);
          px(x, y + 2 * PX, c.w, 3, "#9aa0a6", c.alpha + 0.04);
          px(x + 6 * PX, y + 5 * PX, c.w - 12, 2, "#9aa0a6", c.alpha);
        }
        // low-lying haze
        px(0, H() - 14 * PX, Math.ceil(W() / PX), 14, "#c9cbcf", 0.10);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [mapId]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
