import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { spring } from "../../lib/motion";

// Segmented tab strip with a sliding highlight (shared layoutId per group).
export function Segmented<T extends string>({
  group,
  value,
  onChange,
  options,
  className = "",
  size = "md",
}: {
  group: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: ReactNode; icon?: ReactNode; badge?: ReactNode; title?: string }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  return (
    <div role="tablist" className={`flex items-stretch border-4 border-black bg-white shadow-neo-sm ${className}`}>
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap font-black uppercase tracking-wide transition-colors ${pad} ${
              i > 0 ? "border-l-4 border-black" : ""
            } ${active ? "text-black" : "text-black/60 hover:bg-neo-bg hover:text-black"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                transition={spring.snappy}
                className="absolute inset-0 bg-neo-accent"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
              {o.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
