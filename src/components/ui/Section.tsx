import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "../../lib/motion";

const BAR: Record<string, string> = {
  accent: "bg-neo-accent",
  yellow: "bg-neo-secondary",
  muted: "bg-neo-muted",
  pink: "bg-neo-pink",
  blue: "bg-neo-blue",
  ok: "bg-neo-ok",
};

// Card section with a colored header strip — the one container style for
// Stats, Profile and Shop so every page reads the same way.
export function Section({
  icon,
  title,
  sub,
  right,
  children,
  color = "accent",
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  color?: keyof typeof BAR;
  className?: string;
}) {
  return (
    <motion.section variants={fadeUp} className={`relative border-4 border-black bg-white shadow-neo ${className}`}>
      <header className={`flex flex-wrap items-center justify-between gap-2 border-b-4 border-black px-4 py-2 ${BAR[color]}`}>
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
          {icon}
          {title}
        </h3>
        {right}
      </header>
      <div className="p-4">
        {sub && <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-black/60">{sub}</p>}
        {children}
      </div>
    </motion.section>
  );
}
