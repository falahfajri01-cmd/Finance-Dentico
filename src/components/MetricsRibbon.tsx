import { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Lock } from "lucide-react";
import { pillarOf, fmtCount, type CoaAccount, type Pillar } from "../data/coa";
import { cn } from "../utils/cn";

const PILLAR_STYLE: Record<Pillar, { text: string; bar: string }> = {
  Aset: { text: "text-primary", bar: "bg-primary" },
  Liabilitas: { text: "text-secondary", bar: "bg-secondary" },
  Ekuitas: { text: "text-tertiary", bar: "bg-tertiary" },
  Pendapatan: { text: "text-emerald-600", bar: "bg-emerald-500" },
  "HPP & Beban": { text: "text-amber-600", bar: "bg-amber-500" },
};

const PILLARS: Pillar[] = ["Aset", "Liabilitas", "Ekuitas", "Pendapatan", "HPP & Beban"];

export default function MetricsRibbon({ accounts }: { accounts: CoaAccount[] }) {
  const loading = accounts.length === 0;
  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.isActive);
    const dist = PILLARS.map((p) => ({
      pillar: p,
      count: active.filter((a) => pillarOf(a) === p).length,
    }));
    const locked = active.filter((a) => a.isLocked);
    const txTotal = accounts.reduce((s, a) => s + a.txCount, 0);
    const headers = active.filter((a) => a.isHeader).length;
    return {
      activeCount: active.length,
      dist,
      total: Math.max(active.length, 1),
      lockedCount: locked.length,
      txTotal,
      headers,
    };
  }, [accounts]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-6">
        {[2, 3, 1].map((span, i) => (
          <div
            key={i}
            className={cn(
              "flex h-[118px] flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-soft",
              span === 2 && "lg:col-span-2", span === 3 && "lg:col-span-3", span === 1 && "lg:col-span-1"
            )}
          >
            <div className="h-3 w-28 animate-pulse rounded bg-surface-container-high" style={{ animationDelay: `${i * 120}ms` }} />
            <div className="h-8 w-16 animate-pulse rounded bg-surface-container-high" style={{ animationDelay: `${i * 120 + 60}ms` }} />
            <div className="h-3 w-40 animate-pulse rounded bg-surface-container-high" style={{ animationDelay: `${i * 120 + 120}ms` }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-6">
      {/* Total active */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.02 }}
        className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-soft lg:col-span-2"
      >
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-primary/[0.05] blur-2xl" />
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            Total Akun Aktif
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-label-sm font-bold text-emerald-700">
            Terverifikasi
          </span>
        </div>
        <div className="flex items-baseline gap-space-sm">
          <span className="text-num-metric-lg text-on-surface">{stats.activeCount}</span>
          <span className="text-label-md font-medium text-on-surface-variant">Akun Terdaftar</span>
        </div>
        <div className="mt-space-sm flex items-center justify-between border-t border-surface-container pt-space-xs">
          <span className="text-body-sm text-on-surface-variant">Konsolidasi 8 Cabang & Group</span>
          <span className="flex items-center text-label-sm font-semibold text-primary">
            100% Imbang
            <CheckCircle2 size={14} className="ml-0.5" />
          </span>
        </div>
      </motion.div>

      {/* Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-soft lg:col-span-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            Distribusi Kategori Akun
          </span>
          <span className="text-label-sm text-outline">5 Pilar Utama</span>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {stats.dist.map(({ pillar, count }) => (
            <div key={pillar} className="flex flex-col rounded-lg bg-surface-container-low p-2 transition-colors hover:bg-surface-container">
              <span className="text-label-sm text-on-surface-variant">{pillar === "HPP & Beban" ? "HPP & Biaya" : pillar}</span>
              <span className={cn("text-headline-sm font-bold tnum", PILLAR_STYLE[pillar].text)}>{count}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
          {stats.dist.map(({ pillar, count }, i) => (
            <motion.div
              key={pillar}
              className={cn("h-full", PILLAR_STYLE[pillar].bar)}
              initial={{ width: 0 }}
              animate={{ width: `${(count / stats.total) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: "easeOut" }}
            />
          ))}
        </div>
      </motion.div>

      {/* GL integrity */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}
        className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-soft"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            Integritas GL
          </span>
          <Lock size={17} className="text-amber-500" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-num-metric-lg text-on-surface">{stats.lockedCount}</span>
            <span className="text-label-sm text-on-surface-variant">Akun Terkunci</span>
          </div>
          <span className="mt-1 text-[11px] leading-tight text-body-sm text-on-surface-variant">
            {fmtCount(stats.txTotal)} histori transaksi ledger. Tidak dapat dihapus sembarangan.
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-[11px] text-label-sm font-medium text-on-surface">Audit Safe Lock</span>
        </div>
      </motion.div>
    </div>
  );
}
