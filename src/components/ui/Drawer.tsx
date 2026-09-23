import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaXmark } from "react-icons/fa6";
import { sfx } from "../../lib/sfx";

// Right-side sheet (full screen below sm). Esc / backdrop closes.
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 720,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
  headerExtra?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    sfx("tab", 0.3);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex justify-end" initial="hidden" animate="show" exit="hidden">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            variants={{
              hidden: { x: "100%", rotate: 1.5 },
              show: { x: 0, rotate: 0, transition: { type: "spring", stiffness: 330, damping: 32 } },
            }}
            style={{ maxWidth: width }}
            className="relative flex h-full w-full origin-bottom-right flex-col border-l-4 border-black bg-neo-bg shadow-[-10px_0_0_0_#000]"
          >
            <div className="flex items-center justify-between gap-3 border-b-4 border-black bg-neo-secondary px-4 py-3">
              <div className="min-w-0 text-lg font-black uppercase tracking-tight">{title}</div>
              <div className="flex items-center gap-2">
                {headerExtra}
                <motion.button
                  onClick={onClose}
                  aria-label="Close"
                  whileHover={{ rotate: 90, scale: 1.08 }}
                  whileTap={{ scale: 0.85 }}
                  className="grid h-10 w-10 place-items-center border-4 border-black bg-white text-lg shadow-neo-sm hover:bg-neo-accent"
                >
                  <FaXmark />
                </motion.button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
