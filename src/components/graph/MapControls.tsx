// Bottom-left cluster: zoom / fit / jump-to-next / legend + relic row.
import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useReactFlow } from "@xyflow/react";
import {
  FaPlus,
  FaMinus,
  FaExpand,
  FaLocationCrosshairs,
  FaQuestion,
  FaArrowRight,
  FaStar,
  FaCircleCheck,
  FaCheckDouble,
  FaXmark,
  FaSkull,
  FaStopwatch,
  FaBan,
  FaKhanda,
  FaCrown,
} from "react-icons/fa6";
import { Popover } from "../ui/Popover";
import { ItemTile } from "../ItemTile";
import { useIsMobile } from "../../lib/useMedia";

function CtlButton({
  onClick,
  label,
  children,
  active = false,
  accent = false,
  btnRef,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  active?: boolean;
  accent?: boolean;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <motion.button
      ref={btnRef}
      onClick={onClick}
      aria-label={label}
      title={label}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.88 }}
      className={`grid h-9 w-9 place-items-center md:h-10 md:w-10 border-b-4 border-black text-sm last:border-b-0 ${
        active ? "bg-neo-accent" : accent ? "bg-neo-secondary hover:bg-neo-accent" : "bg-white hover:bg-neo-bg"
      }`}
    >
      {children}
    </motion.button>
  );
}

function Legend() {
  const items: { label: string; cls: string; icon: ReactNode }[] = [
    { label: "Available", cls: "bg-neo-secondary", icon: <FaArrowRight /> },
    { label: "You are here", cls: "bg-neo-accent", icon: <FaStar /> },
    { label: "Solved", cls: "bg-neo-ok", icon: <FaCircleCheck /> },
    { label: "With help", cls: "bg-neo-muted", icon: <FaCheckDouble /> },
    { label: "Failed", cls: "bg-white", icon: <FaXmark className="text-neo-accent" /> },
    { label: "Boss", cls: "bg-black text-neo-secondary", icon: <FaCrown /> },
    { label: "Elite ×1.5", cls: "bg-black text-white", icon: <FaSkull /> },
    { label: "Timed bonus", cls: "bg-neo-blue", icon: <FaStopwatch /> },
    { label: "Purist bonus", cls: "bg-neo-pink text-white", icon: <FaBan /> },
    { label: "Rematch due", cls: "bg-neo-accent text-white", icon: <FaKhanda /> },
  ];
  const keys: [string, string][] = [
    ["Drag / wheel", "Pan"],
    ["Ctrl + wheel / pinch", "Zoom"],
    ["WASD / arrows", "Pan"],
    ["+ / −", "Zoom"],
    ["F", "Fit act"],
    ["N", "Jump to next node"],
    ["[ / ]", "Switch act"],
    ["1–4 · Ctrl+↵", "Pick result · submit"],
  ];
  return (
    <div className="w-72 text-[10px] font-black uppercase">
      <div className="border-b-4 border-black bg-neo-secondary px-3 py-1.5 tracking-widest">Legend</div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 p-3">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-1.5">
            <span className={`grid h-5 w-5 place-items-center border-2 border-black text-[10px] ${it.cls}`}>{it.icon}</span>
            {it.label}
          </li>
        ))}
      </ul>
      <div className="border-y-4 border-black bg-neo-muted px-3 py-1.5 tracking-widest">Controls</div>
      <ul className="flex flex-col gap-1 p-3">
        {keys.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-2">
            <kbd className="border-2 border-black bg-neo-bg px-1 font-mono text-[10px]">{k}</kbd>
            <span className="text-black/60">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MapControls({ onFit, onNext, relics }: { onFit: () => void; onNext: () => void; relics: string[] }) {
  const rf = useReactFlow();
  const mobile = useIsMobile();
  const [legend, setLegend] = useState(false);
  const legendRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-end gap-2 md:bottom-4 md:left-4">
      <div className="pointer-events-auto flex flex-col border-4 border-black bg-white shadow-neo-sm">
        <CtlButton onClick={onNext} label="Jump to next node (N)" accent>
          <FaLocationCrosshairs />
        </CtlButton>
        {!mobile && (
          <>
            <CtlButton onClick={() => rf.zoomIn({ duration: 220 })} label="Zoom in (+)">
              <FaPlus />
            </CtlButton>
            <CtlButton onClick={() => rf.zoomOut({ duration: 220 })} label="Zoom out (−)">
              <FaMinus />
            </CtlButton>
          </>
        )}
        <CtlButton onClick={onFit} label="Fit act (F)">
          <FaExpand />
        </CtlButton>
        <CtlButton btnRef={legendRef} onClick={() => setLegend((o) => !o)} label="Legend & controls" active={legend}>
          <FaQuestion />
        </CtlButton>
      </div>

      {relics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-auto flex max-w-[calc(100vw-5.5rem)] flex-wrap items-center gap-2 border-4 border-black bg-white/90 p-2 shadow-neo-sm backdrop-blur-sm md:max-w-md"
        >
          {relics.map((id) => (
            <ItemTile key={id} id={id} size="sm" tipSide="top" />
          ))}
        </motion.div>
      )}

      <Popover open={legend} anchorRef={legendRef} onClose={() => setLegend(false)} side="right" align="end">
        <Legend />
      </Popover>
    </div>
  );
}
