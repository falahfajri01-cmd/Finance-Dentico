import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "../utils/cn";

export interface ToastItem {
  id: number;
  type: "success" | "info" | "error";
  title: string;
  desc?: string;
}

export type PushToast = (type: ToastItem["type"], title: string, desc?: string) => void;

const STYLE = {
  success: { Icon: CheckCircle2, fg: "text-emerald-600", bar: "bg-emerald-500" },
  info: { Icon: Info, fg: "text-primary", bar: "bg-primary-container" },
  error: { Icon: TriangleAlert, fg: "text-error", bar: "bg-error" },
};

export default function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => {
          const { Icon, fg, bar } = STYLE[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 48, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest p-3 pl-4 shadow-pop"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", bar)} />
              <Icon size={19} className={cn("mt-0.5 shrink-0", fg)} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-snug text-on-surface">{t.title}</p>
                {t.desc && <p className="mt-0.5 text-[11.5px] leading-snug text-on-surface-variant">{t.desc}</p>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
