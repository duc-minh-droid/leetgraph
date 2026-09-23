import { useEffect, useRef } from "react";
import { animate, useMotionValue, motion, useTransform } from "framer-motion";
import { reduceFx } from "../../lib/juice";

// Rolls from the previous value to the new one; flashes green/red on change.
export function NumberTicker({
  value,
  className = "",
  duration = 0.9,
  flash = true,
  format = (n: number) => Math.round(n).toString(),
}: {
  value: number;
  className?: string;
  duration?: number;
  flash?: boolean;
  format?: (n: number) => string;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  const prev = useRef(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    if (reduceFx()) {
      mv.set(value);
      return;
    }
    const ctl = animate(mv, value, { duration, ease: [0.2, 0.8, 0.2, 1] });
    if (flash && ref.current) {
      ref.current.animate(
        [
          { color: value > from ? "#16a34a" : "#FF6B6B", transform: "scale(1.3)" },
          { transform: "scale(1)" },
        ],
        { duration: duration * 1000, easing: "cubic-bezier(.3,1.5,.5,1)" }
      );
    }
    return () => ctl.stop();
  }, [value, duration, flash, mv]);

  return (
    <motion.span ref={ref} className={`inline-block tabular-nums ${className}`}>
      {text}
    </motion.span>
  );
}
