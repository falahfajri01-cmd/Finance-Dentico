import { motion } from "framer-motion";
import {
  Banknote, Package, BarChart3, Wallet, BadgeCheck, TrendingUp, TrendingDown, Flame,
} from "lucide-react";
import {
  fmtRpJt, fmtPct, fmtDelta, type FinanceMonth, type FinanceMeta,
} from "../../data/finance";
import { cn } from "../../utils/cn";

interface KpiGridProps {
  current: FinanceMonth;
  prev: { data: FinanceMonth; label: string } | null;
  meta: FinanceMeta;
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5 rounded-full px-space-xs py-0.5 text-label-sm", className)}>
      {children}
    </span>
  );
}

const cardBase =
  "group flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-md shadow-soft transition-all duration-200 hover:shadow-card";

export default function KpiGrid({ current, prev, meta }: KpiGridProps) {
  // Logic aligned with Screenshot: Laba Kotor is after Direct/HPP but before OPEX
  const gross = current.netProfit + current.opex;
  const hppRatio = (current.hpp / current.revenue) * 100;
  const opexRatio = (current.opex / current.revenue) * 100;
  const netMargin = (current.netProfit / current.revenue) * 100;
  const grossMargin = (gross / current.revenue) * 100;

  const revDelta = prev ? fmtDelta(current.revenue, prev.data.revenue) : "+0%";
  const revDeltaUp = prev ? current.revenue >= prev.data.revenue : true;
  const grossDelta = prev ? fmtDelta(gross, prev.data.netProfit + prev.data.opex) : null;
  const targetHit = netMargin >= 25;

  const cards = [
    /* 1 — Revenue */
    <motion.div key="rev" className={cardBase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.02 }}>
      <div className="mb-space-sm flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Total Pendapatan</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-colors group-hover:bg-primary-container group-hover:text-on-primary-container">
          <Banknote size={17} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-num-metric-lg tracking-tight text-on-surface">{fmtRpJt(current.revenue)}</div>
        <div className="mt-1 flex items-center gap-space-xs">
          <Chip className={revDeltaUp ? "bg-emerald-500/10 text-emerald-700" : "bg-error-container text-on-error-container"}>
            {revDeltaUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {revDelta}
          </Chip>
          <span className="text-body-sm text-on-surface-variant">{prev?.label ?? "MoM"}</span>
        </div>
      </div>
      <div className="mt-space-md flex items-center justify-between rounded-lg bg-surface-container-low/60 p-space-xs pt-space-xs text-[11px] text-label-sm text-on-surface-variant">
        <span>Basis: <strong className="text-on-surface">Gross</strong></span>
        <span className="text-outline-variant">•</span>
        <span>Share: <strong className="text-on-surface">100%</strong></span>
      </div>
    </motion.div>,

    /* 2 — Biaya Langsung */
    <motion.div key="hpp" className={cardBase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.07 }}>
      <div className="mb-space-sm flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Biaya Langsung</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-low text-outline transition-colors group-hover:bg-surface-container-highest group-hover:text-on-surface">
          <Package size={17} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-num-metric-lg tracking-tight text-on-surface">{fmtRpJt(current.hpp)}</div>
        <div className="mt-1 flex items-center gap-space-xs">
          <Chip className={hppRatio <= 30 ? "bg-surface-container-low text-on-surface" : "bg-amber-500/10 text-amber-700"}>
            Rasio {fmtPct(current.hpp, current.revenue)}
          </Chip>
          <span className="text-body-sm text-on-surface-variant">Layanan Medis</span>
        </div>
      </div>
      <div className="mt-space-md truncate rounded-lg bg-surface-container-low/60 p-space-xs pt-space-xs text-[11px] text-body-sm text-on-surface-variant">
        Bahan medis & sharing dokter
      </div>
    </motion.div>,

    /* 3 — Laba Kotor */
    <motion.div key="gross" className={cardBase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
      <div className="mb-space-sm flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Laba Kotor</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-colors group-hover:bg-primary-container group-hover:text-on-primary-container">
          <BarChart3 size={17} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-num-metric-lg tracking-tight text-primary">{fmtRpJt(gross)}</div>
        <div className="mt-1 flex items-center gap-space-xs">
          <Chip className="bg-surface-container-highest text-primary">Margin {fmtPct(gross, current.revenue)}</Chip>
          {grossDelta && <span className="text-body-sm text-on-surface-variant">{grossDelta}</span>}
        </div>
      </div>
      <div className="mt-space-md rounded-lg bg-surface-container-low/60 p-space-xs pt-space-xs text-[11px] text-body-sm text-on-surface-variant">
        Benchmark grup: &gt;72%
      </div>
    </motion.div>,

    /* 4 — Beban Operasional */
    <motion.div key="opex" className={cardBase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17 }}>
      <div className="mb-space-sm flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Beban Ops & Adm</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant transition-colors group-hover:bg-surface-container-high">
          <Wallet size={17} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-num-metric-lg tracking-tight text-on-surface">{fmtRpJt(current.opex)}</div>
        <div className="mt-1 flex items-center gap-space-xs">
          <Chip className="bg-surface-container text-on-surface-variant">{fmtPct(current.opex, current.revenue)} Revenue</Chip>
          <span className={cn("text-body-sm", opexRatio <= 50 ? "text-on-surface-variant" : "text-amber-600")}>
            {opexRatio <= 50 ? "Normal" : "Tinggi"}
          </span>
        </div>
      </div>
      <div className="mt-space-md truncate rounded-lg bg-surface-container-low/60 p-space-xs pt-space-xs text-[11px] text-body-sm text-on-surface-variant">
        Gaji, Listrik & Pemasaran
      </div>
    </motion.div>,

    /* 5 — Laba Bersih */
    <motion.div key="net" className={cardBase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}>
      <div className="mb-space-sm flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-wider text-primary-fixed">Laba Bersih (Net)</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-highest text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
          <BadgeCheck size={17} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-num-metric-lg tracking-tight text-primary">{fmtRpJt(current.netProfit)}</div>
        <div className="mt-1 flex items-center gap-space-xs">
          <Chip className="bg-surface-container-high text-primary">Net Margin {fmtPct(current.netProfit, current.revenue)}</Chip>
        </div>
      </div>
      <div
        className={cn(
          "mt-space-md flex items-center gap-1 truncate rounded-lg p-space-xs pt-space-xs text-[11px] text-label-sm font-semibold",
          targetHit ? "bg-surface-container-highest/60 text-primary" : "bg-amber-500/10 text-amber-700"
        )}
      >
        <Flame size={13} />
        {targetHit ? `Target Tercapai (+${meta.netTargetDeltaPct}%)` : "Di bawah target periode"}
      </div>
    </motion.div>,
  ];

  return (
    <section className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-5">
      {cards}
    </section>
  );
}
