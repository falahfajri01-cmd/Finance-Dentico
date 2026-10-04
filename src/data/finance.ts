import seedData from "./finance.seed.json";
import type { Journal } from "./journal";
import { buildPeriodOptions, deriveMonths, monthLabelShort, monthsInPeriod, type MonthKey, type PeriodKey } from "../utils/periods";

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

/* ── Period selection ──────────────────────────────────────────────────
 * Opsi periode dibangun dari data (jurnal + tabel bulanan + bulan
 * berjalan), bukan daftar hardcode, sehingga bulan baru langsung muncul.
 * ──────────────────────────────────────────────────────────────────── */

export type { PeriodKey };
export { monthsInPeriod };

/** Opsi periode Overview Keuangan, terbaru lebih dulu. */
export function periodOptions(journals: Journal[], monthly: FinanceMonth[]): ReturnType<typeof buildPeriodOptions> {
  return buildPeriodOptions(
    deriveMonths({
      dates: journals.map((j) => j.date),
      keys: monthly.map((m) => m.id),
    })
  );
}

const sum = (months: FinanceMonth[], f: (m: FinanceMonth) => number) =>
  months.reduce((s, m) => s + f(m), 0);

/**
 * Aggregate a period (single month, quarter, or YTD) into a FinanceMonth-like row.
 * Periode tanpa baris di `finance_monthly` menghasilkan angka nol — bukan
 * diam-diam memakai bulan lain, supaya label periode tidak pernah berbohong.
 */
export function aggregatePeriod(monthly: FinanceMonth[], period: PeriodKey): FinanceMonth {
  const ids = monthsInPeriod(period, monthly.map((m) => m.id));
  const picked = monthly.filter((m) => ids.includes(m.id));
  const empty = {
    id: period, label: period, labelLong: period,
    revenue: 0, hpp: 0, opex: 0, netProfit: 0,
  };
  if (picked.length === 0) return empty;
  return {
    ...empty,
    revenue: sum(picked, (m) => m.revenue),
    hpp: sum(picked, (m) => m.hpp),
    opex: sum(picked, (m) => m.opex),
    netProfit: sum(picked, (m) => m.netProfit),
  };
}

/**
 * The period to compare against, for delta chips.
 * `availableMonths` adalah daftar periode yang bisa dipilih (dari jurnal +
 * tabel), jadi pembanding tetap ada meski `finance_monthly` belum punya baris.
 */
export function previousPeriod(
  monthly: FinanceMonth[],
  period: PeriodKey,
  availableMonths: MonthKey[] = monthly.map((m) => m.id),
): { data: FinanceMonth; label: string } | null {
  const span = monthsInPeriod(period, availableMonths);
  if (span.length === 0) return null;
  // Dibanding dengan bulan tepat sebelum periode terpilih (di luar cakupannya).
  const oldest = span[span.length - 1];
  const older = [...availableMonths].sort().reverse().find((m) => m < oldest);
  if (!older) return null;
  return { data: aggregatePeriod(monthly, older), label: `vs ${monthLabelShort(older)}` };
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
