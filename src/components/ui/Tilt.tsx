import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { reduceFx } from "../../lib/juice";

// 3D tilt that follows the pointer. Wrap any card.
export function Tilt({
  children,
  className = "",
  max = 8,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 300, damping: 22 });
  const sy = useSpring(py, { stiffness: 300, damping: 22 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);

  const off = disabled || reduceFx();
  return (
    <motion.div
      ref={ref}
      className={className}
      style={off ? undefined : { rotateX, rotateY, transformPerspective: 800 }}
      onPointerMove={(e) => {
        if (off || e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
