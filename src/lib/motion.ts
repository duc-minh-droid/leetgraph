// Shared motion vocabulary — every component pulls springs/variants from here
// so the whole app moves with one personality (snappy, slightly bouncy).
import type { Transition, Variants } from "framer-motion";

export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 32 } as Transition,
  bouncy: { type: "spring", stiffness: 420, damping: 16 } as Transition,
  soft: { type: "spring", stiffness: 240, damping: 28 } as Transition,
  slam: { type: "spring", stiffness: 380, damping: 13 } as Transition,
};

// Buttons / tappables.
export const tap = { scale: 0.94 };
export const hover = { scale: 1.04 };
export const hoverLift = { y: -3 };

export const fadeUp: Variants = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: spring.soft },
};

export const pop: Variants = {
  hidden: { scale: 0.6, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: spring.bouncy },
};

export const stagger = (step = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

// Tab/page swap.
export const pageSwap: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(2px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.14, ease: "easeIn" } },
};
