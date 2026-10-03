import seedData from "./finance.seed.json";

/* ────────────────────────────────────────────────────────────────────
 * Finance Overview domain types — mirrors `finance_monthly` and
 * `finance_overview_meta` tables in Supabase
 * ──────────────────────────────────────────────────────────────────── */
export interface FinanceMonth {
  id: string;          // "2026-09"
  label: string;       // "Sep"
  labelLong: string;   // "September 2026"
  revenue: number;
  hpp: number;
  opex: number;
  netProfit: number;
}

export interface BrandSplit {
  name: string;
  amount: number;
  color: "primary" | "secondary" | "tertiary";
}

export interface BranchRank {
  rank: number;
  name: string;
  amount: number;
}

export interface TopExpense {
  code: string;
  name: string;
  amount: number;
}

export interface PipelineStatus {
  draftCount: number;
  draftAmount: number;
  reviewCount: number;
  reviewAmount: number;
  postedCount: number;
  lockedPeriod: string;
  reconMatchedPct: number;
  reconDiffAmount: number;
  reconPendingCount: number;
}

export interface FinanceMeta {
  periodLabel: string;
  periodStatus: string;
  revenueMix: { jasaMedis: number; produk: number };
  grossMarginBenchmark: number;
  netTargetDeltaPct: number;
  autoSyncMinutes: number;
  brands: BrandSplit[];
  branches: BranchRank[];
  branchCount: number;
  topExpenses: TopExpense[];
  pipeline: PipelineStatus;
}

export interface FinanceBundle {
  monthly: FinanceMonth[];
  meta: FinanceMeta;
}

export const SEED_FINANCE: FinanceBundle = seedData as FinanceBundle;

/* ── Period selection ──────────────────────────────────────────────── */
export type PeriodKey = "2026-09" | "2026-08" | "2026-07" | "Q3";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "2026-09", label: "September 2026" },
  { key: "2026-08", label: "Agustus 2026" },
  { key: "2026-07", label: "Juli 2026" },
  { key: "Q3", label: "Q3 2026 (YTD)" },
];

const sum = (months: FinanceMonth[], f: (m: FinanceMonth) => number) =>
  months.reduce((s, m) => s + f(m), 0);

/** Aggregate a period (single month or Q3) into a FinanceMonth-like row */
export function aggregatePeriod(monthly: FinanceMonth[], period: PeriodKey): FinanceMonth {
  if (period === "Q3") {
    const q3 = monthly.filter((m) => ["2026-07", "2026-08", "2026-09"].includes(m.id));
    return {
      id: "Q3", label: "Q3", labelLong: "Q3 2026 (Jul–Sep)",
      revenue: sum(q3, (m) => m.revenue),
      hpp: sum(q3, (m) => m.hpp),
      opex: sum(q3, (m) => m.opex),
      netProfit: sum(q3, (m) => m.netProfit),
    };
  }
  return monthly.find((m) => m.id === period) ?? monthly[monthly.length - 1];
}

/** The period to compare against (previous month / Q2), for delta chips */
export function previousPeriod(monthly: FinanceMonth[], period: PeriodKey): { data: FinanceMonth; label: string } | null {
  if (period === "Q3") {
    const q2 = monthly.filter((m) => ["2026-04", "2026-05", "2026-06"].includes(m.id));
    return {
      data: {
        id: "Q2", label: "Q2", labelLong: "Q2 2026",
        revenue: sum(q2, (m) => m.revenue), hpp: sum(q2, (m) => m.hpp),
        opex: sum(q2, (m) => m.opex), netProfit: sum(q2, (m) => m.netProfit),
      },
      label: "vs Q2",
    };
  }
  const idx = monthly.findIndex((m) => m.id === period);
  if (idx <= 0) return null;
  return { data: monthly[idx - 1], label: `vs ${monthly[idx - 1].label}` };
}

/* ── Formatting helpers (Indonesian locale) ────────────────────────── */
/** "Rp 842.5jt" — short juta style used across the executive cards */
export function fmtRpJt(v: number): string {
  return `Rp ${(v / 1e6).toFixed(1)}jt`;
}

/** "Rp 142.000.000" — full grouped rupiah */
export function fmtRpFull(v: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(v)}`;
}

/** "23.2%" */
export function fmtPct(part: number, whole: number, digits = 1): string {
  if (!whole) return "0%";
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

/** "+14.2%" / "-3.1%" delta between current and previous */
export function fmtDelta(curr: number, prev: number): string {
  if (!prev) return "+0%";
  const d = ((curr - prev) / Math.abs(prev)) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}
