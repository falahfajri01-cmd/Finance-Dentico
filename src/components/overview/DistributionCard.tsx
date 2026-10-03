import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { fmtRpJt, type FinanceMeta } from "../../data/finance";
import { cn } from "../../utils/cn";
import type { PushToast } from "../Toasts";

const BRAND_STYLE: Record<string, { dot: string; bar: string }> = {
  primary: { dot: "bg-primary", bar: "bg-primary" },
  secondary: { dot: "bg-secondary-container", bar: "bg-secondary-container" },
  tertiary: { dot: "bg-tertiary", bar: "bg-tertiary" },
};

export default function DistributionCard({ meta, pushToast }: { meta: FinanceMeta; pushToast: PushToast }) {
  const total = meta.brands.reduce((s, b) => s + b.amount, 0) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2 }}
      className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg shadow-soft"
    >
      <div className="mb-space-sm flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-headline-md text-on-surface">Distribusi Pendapatan</h2>
          <span className="text-body-sm text-on-surface-variant">Breakdown Brand & Cabang</span>
        </div>
        <button
          onClick={() => pushToast("info", "Opsi Distribusi", "Ekspor breakdown per entitas tersedia di menu Laporan.")}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant transition-colors hover:text-primary"
          aria-label="Opsi"
        >
          <MoreHorizontal size={17} />
        </button>
      </div>

      {/* Brands */}
      <div className="my-space-xs flex flex-col gap-space-sm">
        <span className="text-label-sm uppercase tracking-wider text-outline">Kontribusi Per Brand</span>
        {meta.brands.map((b, i) => {
          const pct = Math.round((b.amount / total) * 100);
          const style = BRAND_STYLE[b.color] ?? BRAND_STYLE.primary;
          return (
            <div key={b.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-on-surface">
                <span className="flex items-center gap-1.5 text-label-md">
                  <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
                  {b.name}
                </span>
                <span className="text-num-table-md font-semibold">
                  {fmtRpJt(b.amount)} <span className="font-normal text-on-surface-variant">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                <motion.div
                  className={cn("h-full rounded-full", style.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Branch ranking */}
      <div className="mt-space-md flex flex-col gap-space-xs rounded-xl bg-surface-container-low/50 p-space-sm pt-space-md">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-label-sm uppercase tracking-wider text-outline">Top 3 Cabang Berkinerja</span>
          <button
            onClick={() => pushToast("info", `Semua Cabang (${meta.branchCount})`, "Modul Branch & Cabang tersedia di roadmap berikutnya.")}
            className="text-label-sm text-primary transition-opacity hover:opacity-70 hover:underline"
          >
            Semua ({meta.branchCount})
          </button>
        </div>
        {meta.branches.map((b) => (
          <div key={b.rank} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-space-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-container-high text-[10px] font-bold text-primary tnum">
                {b.rank}
              </span>
              <span className="text-body-md font-medium text-on-surface">{b.name}</span>
            </div>
            <span className="text-num-table-md font-semibold text-on-surface">{fmtRpJt(b.amount)}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
