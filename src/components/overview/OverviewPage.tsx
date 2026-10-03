import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download, CirclePlus, ChevronDown, Calendar, ListFilter, RefreshCw, Zap, ArrowRight,
} from "lucide-react";
import KpiGrid from "./KpiGrid";
import TrendChart from "./TrendChart";
import DistributionCard from "./DistributionCard";
import LedgerCards from "./LedgerCards";
import { fetchFinanceBundle } from "../../data/financeRepository";
import {
  aggregatePeriod, previousPeriod, PERIOD_OPTIONS,
  type FinanceBundle, type FinanceMonth, type PeriodKey,
} from "../../data/finance";
import { fetchAccounts } from "../../data/coaRepository";
import { fetchPnlLines } from "../../data/pnlRepository";
import {
  getJournals, initJournalStore, subscribeJournals,
} from "../../data/journalStore";
import { computeStatement, getScopedPnlLines, type PnlLine } from "../../data/pnl";
import type { CoaAccount } from "../../data/coa";
import type { Journal } from "../../data/journal";
import { cn } from "../../utils/cn";
import type { PushToast } from "../Toasts";
import useScopeStore from "../../hooks/useScopeStore";
import { addBrand, addBranch, getBrands } from "../../data/scopeStore";

/* ── Scope helpers (same logic as P&L and GL) ──────────────────────── */
function matchesEntity(filter: string, j: Journal): boolean {
  if (filter === "Dentico Group (Consolidated)") return true;
  return j.brand.toLowerCase().includes(filter.toLowerCase().split(" - ")[0].toLowerCase());
}

function matchesBranch(filter: string, j: Journal): boolean {
  if (filter === "Semua Cabang (5)") return true;
  const scope = j.branch.toLowerCase().includes(j.brand.toLowerCase())
    ? j.branch.toLowerCase()
    : `${j.brand} - ${j.branch}`.toLowerCase();
  const tokens = filter.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.every((t) => scope.includes(t));
}

type PnlMonthId = "2026-09" | "2026-08" | "2026-07";

function periodOf(date: string): PnlMonthId | null {
  if (date.startsWith("2026-09")) return "2026-09";
  if (date.startsWith("2026-08")) return "2026-08";
  if (date.startsWith("2026-07")) return "2026-07";
  return null;
}



interface OverviewPageProps {
  pushToast: PushToast;
  onDrillCoa: (code: string) => void;
  onOpenJournal: (status?: "ALL" | "DRAFT" | "REVIEW" | "APPROVED" | "POSTED" | "LOCKED") => void;
  onOpenLedger: () => void;
}

const selectCls =
  "w-full cursor-pointer appearance-none rounded-xl py-2 pl-3 pr-8 text-label-md outline-none transition-all";

function Skeleton() {
  return (
    <div className="flex flex-col gap-space-md">
      <div className="h-16 animate-pulse rounded-2xl bg-surface-container-lowest shadow-soft" />
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-container-lowest shadow-soft" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-12">
        <div className="h-96 animate-pulse rounded-2xl bg-surface-container-lowest shadow-soft lg:col-span-8" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface-container-lowest shadow-soft lg:col-span-4" />
      </div>
    </div>
  );
}

export default function OverviewPage({ pushToast, onDrillCoa, onOpenJournal, onOpenLedger }: OverviewPageProps) {
  const [bundle, setBundle] = useState<FinanceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("2026-09");
  const [entity, setEntity] = useState("Dentico Group (Consolidated)");
  const [branch, setBranch] = useState("Semua Cabang (Grup)");
  const [journalFilter, setJournalFilter] = useState("Semua Jurnal Posted");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [pnlLines, setPnlLines] = useState<PnlLine[]>([]);

  // Scope store (brands & branches)
  const scope = useScopeStore();
  const [addingBrand, setAddingBrand] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchBrandId, setNewBranchBrandId] = useState("");

  useEffect(() => {
    initJournalStore();
    let alive = true;
    (async () => {
      const [fRes, aRes, pRes] = await Promise.all([
        fetchFinanceBundle(), fetchAccounts(), fetchPnlLines()
      ]);
      if (!alive) return;
      setBundle(fRes.data);
      setAccounts(aRes.data);
      setPnlLines(pRes.data);
      setJournals(getJournals());
      setLoading(false);
    })();
    const unsub = subscribeJournals(() => setJournals(getJournals()));
    return () => { alive = false; unsub(); };
  }, []);

  const scopedMode = entity !== "Dentico Group (Consolidated)" || branch !== "Semua Cabang (5)";

  /** Filter journals by current entity/branch scope */
  const scopedJournals = useMemo(() => {
    if (!scopedMode) return journals;
    return journals.filter((j) => matchesEntity(entity, j) && matchesBranch(branch, j));
  }, [journals, entity, branch, scopedMode]);

  /** Build a FinanceMonth from the P&L compute engine for EXACT consistency */
  const buildPnlMonth = (periodId: "2026-09" | "2026-08" | "2026-07" | "Q3"): FinanceMonth => {
    const eff = getScopedPnlLines(pnlLines, journals, entity, branch);
    const st = computeStatement(eff, accounts, periodId);
    return {
      id: periodId,
      label: periodId.split("-")[1] === "09" ? "Sep" : periodId.split("-")[1] === "08" ? "Ags" : "Jul",
      labelLong: periodId,
      revenue: st.pendapatan,
      hpp: st.biayaLangsung,      // mapped to card 2 "Biaya Langsung"
      opex: st.bebanOps,
      netProfit: st.labaBersih,
    };
  };

  const derived = useMemo(() => {
    if (!bundle) return null;
    if (!scopedMode) {
      return {
        current: aggregatePeriod(bundle.monthly, period),
        prev: previousPeriod(bundle.monthly, period),
      };
    }
    // Scoped: compute perfectly identical to P&L
    const current = buildPnlMonth(period);
    const mIds: PnlMonthId[] = ["2026-07", "2026-08", "2026-09"];
    const monthly = mIds.map((id) => buildPnlMonth(id as any));

    let prev: { data: FinanceMonth; label: string } | null = null;
    if (period !== "Q3") {
      const prevId = period === "2026-09" ? "2026-08" : period === "2026-08" ? "2026-07" : null;
      if (prevId) {
        prev = {
          data: buildPnlMonth(prevId as any),
          label: `vs ${prevId.split("-")[1] === "08" ? "Ags" : "Jul"}`,
        };
      }
    }

    // Top 5 Expenses dynamic calculation for scoped mode
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();
    for (const j of scopedJournals) {
      if (j.status !== "POSTED") continue; // FIX: Hanya hitung jurnal yang sudah POSTED
      
      const p = periodOf(j.date);
      if (period !== "Q3" && p !== period) continue;
      if (period === "Q3" && (!p || !mIds.includes(p))) continue;
      
      for (const l of j.lines) {
        if (!l.accountCode.startsWith("5") && !l.accountCode.startsWith("6")) continue;
        const delta = l.debit - l.credit;
        if (delta <= 0) continue;
        const exist = expenseMap.get(l.accountCode);
        if (exist) exist.amount += delta;
        else expenseMap.set(l.accountCode, { code: l.accountCode, name: l.accountName, amount: delta });
      }
    }
    const topExpenses = [...expenseMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { current, prev, monthly, topExpenses };
  }, [bundle, period, scopedMode, scopedJournals, pnlLines, accounts]);

  const handleExport = () => {
    if (!bundle) return;
    const header = "period,label,revenue,hpp,opex,net_profit";
    const rows = bundle.monthly.map((m) => `${m.id},${m.labelLong},${m.revenue},${m.hpp},${m.opex},${m.netProfit}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentico-finance-overview-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Laporan diekspor", "Snapshot bulanan Pendapatan/HPP/OPEX/Laba (CSV).");
  };

  const periodLabel = PERIOD_OPTIONS.find((o) => o.key === period)?.label ?? "September 2026";

  return (
    <div className="relative flex w-full flex-col gap-space-lg">
      {/* Glow accents */}
      <div className="pointer-events-none absolute -top-10 left-1/4 -z-10 h-80 w-80 rounded-full bg-primary-container/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-8 top-40 -z-10 h-72 w-72 rounded-full bg-secondary-container/10 blur-3xl" aria-hidden />

      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-surface-container-highest px-space-sm py-0.5 text-label-sm uppercase tracking-wider text-primary">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary" />
                Fintech Engine v2.4
              </span>
              <span className="text-body-sm text-outline-variant">•</span>
              <span className="text-body-sm text-on-surface-variant">Real-time GL Synced</span>
            </div>
            <h1 className="text-headline-xl tracking-tight text-on-surface">Executive Financial Overview</h1>
            <p className="text-body-md text-on-surface-variant">
              Real-time consolidated analytics dari jurnal terposting{" "}
              <span className="text-outline-variant">•</span> Periode:{" "}
              <span className="font-medium text-primary">{periodLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              onClick={handleExport}
              className="flex items-center gap-space-xs rounded-xl border border-surface-container bg-surface-container-lowest px-space-md py-2.5 text-on-surface shadow-soft transition-all duration-150 hover:bg-surface-container active:scale-[0.98]"
            >
              <Download size={17} className="text-outline" />
              <span className="text-label-md">Export Laporan</span>
              <span className="rounded bg-surface-container px-space-xs py-0.5 text-[10px] text-label-sm text-on-surface-variant">CSV</span>
            </button>
            <button
              onClick={() => onOpenJournal()}
              className="flex items-center gap-space-xs rounded-xl bg-primary-container px-space-md py-2.5 text-on-primary-container shadow-card transition-all duration-150 hover:bg-secondary active:scale-[0.98]"
            >
              <CirclePlus size={19} />
              <span className="text-label-md tracking-wide">Input Jurnal Baru</span>
            </button>
          </div>
        </div>

        {/* Filter strip */}
        <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-2xl bg-surface-container-lowest p-space-sm shadow-soft">
          <div className="flex flex-wrap items-center gap-space-xs sm:gap-space-sm">
            {/* Entity (Brand) */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <select
                  value={entity}
                  onChange={(e) => { if (e.target.value === "__add__") { setAddingBrand(true); } else setEntity(e.target.value); }}
                  className={cn(selectCls, "bg-primary text-on-primary shadow-soft hover:bg-secondary")}
                >
                  {scope.brandFilterOpts.map((o) => <option key={o}>{o}</option>)}
                  <option value="__add__">＋ Tambah Brand Baru…</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-primary" />
              </div>
            </div>
            {/* Cabang (Branch) */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <select
                  value={branch}
                  onChange={(e) => { if (e.target.value === "__add__") { setAddingBranch(true); setNewBranchBrandId(scope.brands[0]?.id ?? ""); } else setBranch(e.target.value); }}
                  className={cn(selectCls, "bg-surface-container-low text-on-surface hover:bg-surface-container")}
                >
                  {scope.cabangFilterOpts.map((o) => <option key={o}>{o}</option>)}
                  <option value="__add__">＋ Tambah Cabang Baru…</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline" />
              </div>
            </div>
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                className={cn(selectCls, "bg-surface-container-low font-bold text-primary hover:bg-surface-container")}
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <Calendar size={15} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-primary" />
            </div>
            <div className="relative">
              <select
                value={journalFilter}
                onChange={(e) => setJournalFilter(e.target.value)}
                className={cn(selectCls, "bg-surface-container-low text-on-surface hover:bg-surface-container")}
              >
                <option>Semua Jurnal Posted</option>
                <option>Semua Status (Draft + Review)</option>
                <option>Jurnal Penyesuaian Saja</option>
              </select>
              <ListFilter size={15} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline" />
            </div>
          </div>
          <div className="flex items-center gap-space-xs rounded-xl bg-surface-container-low px-space-sm py-1.5 text-label-sm text-on-surface-variant">
            <RefreshCw size={14} className="text-primary" />
            <span>
              Auto-sync POS: <span className="font-bold text-on-surface">Aktif ({bundle?.meta.autoSyncMinutes ?? 2}m lalu)</span>
            </span>
          </div>
        </div>
      </motion.section>

      {loading || !bundle || !derived ? (
        <Skeleton />
      ) : (
        <>
          {/* Period status banner */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="relative flex flex-col justify-between gap-space-sm overflow-hidden rounded-2xl bg-surface-container-high p-space-md shadow-soft md:flex-row md:items-center"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-container/10 blur-2xl" />
            <div className="z-10 flex items-center gap-space-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-soft">
                <Zap size={18} />
              </div>
              <div className="flex flex-col">
                <span className="flex flex-wrap items-center gap-2 text-headline-sm text-on-surface">
                  Periode {bundle.meta.periodLabel} berstatus
                  <span className="rounded-full bg-primary-container px-space-xs py-0.5 text-[11px] uppercase tracking-wider text-label-sm text-on-primary-container">
                    {bundle.meta.periodStatus}
                  </span>
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  Terdapat <span className="font-semibold text-primary">{bundle.meta.pipeline.reviewCount} Jurnal Review</span> &{" "}
                  <span className="font-semibold text-secondary">{bundle.meta.pipeline.reconPendingCount} Rekonsiliasi QRIS</span>{" "}
                  belum diselesaikan sebelum Tutup Buku.
                </span>
              </div>
            </div>
            <button
              onClick={() => onOpenJournal("REVIEW")}
              className="z-10 inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-surface-container-lowest px-space-md py-2 text-label-md text-primary shadow-soft transition-all hover:bg-surface-container active:scale-[0.98]"
            >
              <span>Lihat Antrean Review</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* KPI cards */}
          <KpiGrid current={derived.current} prev={derived.prev} meta={bundle.meta} />

          {/* Charts */}
          <section className="grid grid-cols-1 gap-space-md lg:grid-cols-12">
            <div className="lg:col-span-8">
              <TrendChart monthly={derived.monthly || bundle.monthly} currentId={period === "Q3" ? "2026-09" : period} />
            </div>
            <div className="lg:col-span-4">
              <DistributionCard meta={bundle.meta} pushToast={pushToast} />
            </div>
          </section>

          {/* Bottom ledger cards */}
          <LedgerCards meta={bundle.meta} topExpenses={derived.topExpenses || bundle.meta.topExpenses} pushToast={pushToast} onDrillCoa={onDrillCoa} onOpenJournal={onOpenJournal} onOpenLedger={onOpenLedger} />
        </>
      )}

      {/* ── Add Brand Modal ──────────────────────────────────── */}
      {addingBrand && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" onClick={() => setAddingBrand(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-space-lg shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-space-md text-headline-sm text-on-surface">Tambah Brand Baru</h3>
            <input
              autoFocus value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="Nama brand, cth: Brand C"
              className="w-full rounded-lg border border-surface-container bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/50"
            />
            <div className="mt-space-md flex items-center justify-end gap-space-sm">
              <button onClick={() => setAddingBrand(false)} className="rounded-lg bg-surface-container px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-high">Batal</button>
              <button
                disabled={!newBrandName.trim()}
                onClick={() => {
                  const b = addBrand(newBrandName.trim());
                  setEntity(b.name);
                  setNewBrandName("");
                  setAddingBrand(false);
                  pushToast("success", `Brand "${b.name}" ditambahkan`, "Tersedia di semua modul filter.");
                }}
                className="rounded-lg bg-primary-container px-4 py-2 text-label-md text-on-primary-container shadow-card transition-all hover:bg-secondary disabled:opacity-40"
              >
                Tambah Brand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Branch Modal ─────────────────────────────────── */}
      {addingBranch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" onClick={() => setAddingBranch(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-space-lg shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-space-md text-headline-sm text-on-surface">Tambah Cabang Baru</h3>
            <div className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm uppercase text-on-surface-variant">Brand Induk</label>
                <select
                  value={newBranchBrandId}
                  onChange={(e) => setNewBranchBrandId(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-surface-container bg-surface-container-low px-3 py-2.5 text-label-md text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/50"
                >
                  {getBrands().map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm uppercase text-on-surface-variant">Nama Cabang</label>
                <input
                  autoFocus value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="cth: Bandung - Dago"
                  className="w-full rounded-lg border border-surface-container bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="mt-space-md flex items-center justify-end gap-space-sm">
              <button onClick={() => setAddingBranch(false)} className="rounded-lg bg-surface-container px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-high">Batal</button>
              <button
                disabled={!newBranchName.trim() || !newBranchBrandId}
                onClick={() => {
                  const brandName = getBrands().find((b) => b.id === newBranchBrandId)?.name ?? "";
                  const br = addBranch(newBranchName.trim(), newBranchBrandId);
                  setBranch(`${brandName} - ${br.name}`);
                  setNewBranchName("");
                  setAddingBranch(false);
                  pushToast("success", `Cabang "${br.name}" ditambahkan`, `Di bawah ${brandName}. Tersedia di semua modul filter.`);
                }}
                className="rounded-lg bg-primary-container px-4 py-2 text-label-md text-on-primary-container shadow-card transition-all hover:bg-secondary disabled:opacity-40"
              >
                Tambah Cabang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
