// Portal-rendered popover anchored to a trigger. Portaled so it never gets
// clipped by overflow containers (the header scrolls horizontally on mobile).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "../../lib/motion";

type Align = "start" | "end" | "center";
type Side = "bottom" | "top" | "left" | "right";

function place(anchor: DOMRect, pop: DOMRect, side: Side, align: Align, gap: number) {
  let x = 0;
  let y = 0;
  if (side === "bottom" || side === "top") {
    y = side === "bottom" ? anchor.bottom + gap : anchor.top - pop.height - gap;
    x =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - pop.width
          : anchor.left + anchor.width / 2 - pop.width / 2;
  } else {
    x = side === "right" ? anchor.right + gap : anchor.left - pop.width - gap;
    y =
      align === "start"
        ? anchor.top
        : align === "end"
          ? anchor.bottom - pop.height
          : anchor.top + anchor.height / 2 - pop.height / 2;
  }
  const pad = 8;
  x = Math.max(pad, Math.min(window.innerWidth - pop.width - pad, x));
  y = Math.max(pad, Math.min(window.innerHeight - pop.height - pad, y));
  return { x, y };
}

export function Popover({
  open,
  anchorRef,
  onClose,
  side = "bottom",
  align = "end",
  gap = 10,
  children,
  className = "",
  interactive = true,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  side?: Side;
  align?: Align;
  gap?: number;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = popRef.current?.getBoundingClientRect();
      if (a && p) setPos(place(a, p, side, align, gap));
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, side, align, gap, anchorRef]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  const origin =
    side === "bottom" ? `${align === "end" ? "right" : align === "start" ? "left" : "center"} top` : side === "top" ? "center bottom" : "center";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popRef}
          initial={{ opacity: 0, scale: 0.9, y: side === "top" ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.1 } }}
          transition={spring.snappy}
          style={{
            left: pos?.x ?? -9999,
            top: pos?.y ?? -9999,
            transformOrigin: origin,
            pointerEvents: interactive ? "auto" : "none",
          }}
          className={`fixed z-[80] border-4 border-black bg-white shadow-neo ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Hover/focus-triggered info card.
export function HoverCard({
  children,
  content,
  side = "bottom",
  align = "center",
  className = "",
  cardClassName = "",
  delay = 120,
}: {
  children: ReactNode;
  content: ReactNode;
  side?: Side;
  align?: Align;
  className?: string;
  cardClassName?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <span
      ref={ref}
      className={`inline-flex ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <Popover open={open} anchorRef={ref} side={side} align={align} interactive={false} className={cardClassName}>
        {content}
      </Popover>
    </span>
  );
}
