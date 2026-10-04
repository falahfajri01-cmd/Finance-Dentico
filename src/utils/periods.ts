/* ────────────────────────────────────────────────────────────────────
 * Period helpers — filter periode yang diturunkan dari data, bukan daftar
 * hardcode.
 *
 * begitu jurnal baru diinput (mis. Oktober 2026), key "2026-10" langsung
 * muncul di Overview Keuangan, Buku Besar, dan Laba Rugi.
 * ──────────────────────────────────────────────────────────────────── */

import { MONTHS_LONG, MONTHS_SHORT, toISODate, today } from "./dateRange";

/** "2026-10" */
export type MonthKey = string;
/**
 * - Month key: "2026-10"
 * - Quarter key: "2026-Q4"
 * - Year-to-date: "2026-YTD"
 */
export type PeriodKey = string;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const QUARTER_RE = /^(\d{4})-Q([1-4])$/;
const YTD_RE = /^(\d{4})-YTD$/;

/** "2026-10-04" → "2026-10" */
export function monthKeyOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function isMonthKey(key: string): key is MonthKey {
  return MONTH_RE.test(key);
}

export function isQuarterKey(key: string): boolean {
  return QUARTER_RE.test(key);
}

export function isYtdKey(key: string): boolean {
  return YTD_RE.test(key);
}

export function monthLabelShort(key: MonthKey): string {
  const i = Number(key.slice(5, 7)) - 1;
  return MONTHS_SHORT[i] ?? key;
}

export function monthLabelLong(key: MonthKey): string {
  const i = Number(key.slice(5, 7)) - 1;
  return `${MONTHS_LONG[i] ?? key.slice(5, 7)} ${key.slice(0, 4)}`;
}

/** "2026-10" → "2026-Q4" */
export function quarterKeyOfMonth(key: MonthKey): string {
  const q = Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1;
  return `${key.slice(0, 4)}-Q${q}`;
}

export function quarterLabel(key: string): string {
  return key.replace("-Q", " Q").replace(/^(\d{4})/, "$1");
}

export function yearLabel(key: string): string {
  return key.replace("-YTD", "");
}

/**
 * Kumpulkan key bulan unik dari berbagai sumber, urut dari yang terbaru.
 * Bulan berjalan selalu disertakan agar periode terbaru langsung selectable.
 */
export function deriveMonths(sources: {
  dates?: string[];
  keys?: string[];
  extra?: MonthKey[];
} = {}): MonthKey[] {
  const set = new Set<MonthKey>();
  for (const d of sources.dates ?? []) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(monthKeyOf(d));
  for (const k of sources.keys ?? []) if (isMonthKey(k)) set.add(k);
  for (const k of sources.extra ?? []) if (isMonthKey(k)) set.add(k);
  set.add(monthKeyOf(toISODate(today())));
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Bulan-bulan yang membentuk sebuah periode, dibatasi daftar bulan tersedia. */
export function monthsInPeriod(period: PeriodKey, months: MonthKey[]): MonthKey[] {
  if (isMonthKey(period)) return months.filter((m) => m === period);

  if (QUARTER_RE.test(period)) {
    return months.filter((m) => quarterKeyOfMonth(m) === period);
  }

  const y = YTD_RE.exec(period);
  if (y) return months.filter((m) => m.startsWith(`${y[1]}-`));

  return [];
}

/** Label periode mengikuti bulan yang benar-benar tersedia. */
export function labelOfPeriod(period: PeriodKey, months: MonthKey[]): string {
  if (isMonthKey(period)) return monthLabelLong(period);
  const q = QUARTER_RE.exec(period);
  if (q) {
    const span = monthsInPeriod(period, months);
    const inner = span.length > 1
      ? ` (${monthLabelShort(span[span.length - 1])}–${monthLabelShort(span[0])})`
      : "";
    return `Q${q[2]} ${q[1]}${inner}`;
  }
  const y = YTD_RE.exec(period);
  if (y) return `YTD ${y[1]}`;
  return period;
}

export interface PeriodOption {
  key: PeriodKey;
  label: string;
  months: MonthKey[];
  group: "month" | "quarter" | "ytd";
}

/**
 * Opsi filter periode: tiap bulan terbaru ke terlama, lalu tiap kuartal,
 * lalu YTD untuk tahun yang punya data.
 */
export function buildPeriodOptions(months: MonthKey[]): PeriodOption[] {
  const sorted = [...months].sort((a, b) => b.localeCompare(a));

  const monthOpts: PeriodOption[] = sorted.map((m) => ({
    key: m, label: monthLabelLong(m), months: [m], group: "month",
  }));

  const quarters = [...new Set(sorted.map(quarterKeyOfMonth))].sort((a, b) => b.localeCompare(a));
  const quarterOpts: PeriodOption[] = quarters.map((qk) => {
    const span = sorted.filter((m) => quarterKeyOfMonth(m) === qk);
    return { key: qk, label: labelOfPeriod(qk, sorted), months: span, group: "quarter" };
  });

  const years = [...new Set(sorted.map((m) => m.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const ytdOpts: PeriodOption[] = years.map((y) => {
    const span = sorted.filter((m) => m.startsWith(`${y}-`));
    return { key: `${y}-YTD`, label: labelOfPeriod(`${y}-YTD`, sorted), months: span, group: "ytd" };
  });

  return [...monthOpts, ...quarterOpts, ...ytdOpts];
}

/** Periode yang paling relevan: bulan terbaru, atau bulan berjalan. */
export function defaultPeriodKey(months: MonthKey[]): PeriodKey {
  return months[0] ?? monthKeyOf(toISODate(today()));
}