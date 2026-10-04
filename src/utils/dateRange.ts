/* ────────────────────────────────────────────────────────────────────
 * Date-range helpers — dipakai Buku Besar & form jurnal.
 *
 * Semua rentang dihitung dari TANGGAL HARI INI, bukan periode tertutup,
 * sehingga filter tidak pernah "buntu" di satu tanggal atau bulan tetap.
 * ──────────────────────────────────────────────────────────────────── */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** "2026-10-04" dari objek Date (timezone lokal, bukan UTC). */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-10-04" → Date lokal tengah malam (aman dari geseran UTC). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "04 Okt 2026" */
export function fmtDateShort(iso: string): string {
  const d = fromISODate(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "4 Oktober 2026" */
export function fmtDateLong(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Oktober 2026" */
export function fmtMonthYear(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/** Tanggal hari ini, dinormalisasi ke tengah malam. */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export interface DateRange {
  from: string; // ISO "2026-10-01"
  to: string;   // ISO "2026-10-04"
}

export type RangePresetId =
  | "custom" | "today" | "week" | "month" | "lastMonth"
  | "quarter" | "ytd" | "all";

export interface RangePreset {
  id: RangePresetId;
  label: string;
  range: DateRange;
}

/** Rentang default saat aplikasi dibuka: awal bulan berjalan → hari ini. */
export function defaultRange(): DateRange {
  const now = today();
  return { from: toISODate(startOfMonth(now)), to: toISODate(now) };
}

function isoWeekRange(d: Date): DateRange {
  const day = d.getDay(); // 0=Min … 6=Sab
  const offset = day === 0 ? 6 : day - 1; // Senin sebagai awal minggu
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
  return { from: toISODate(from), to: toISODate(to) };
}

/**
 * Preset rentang relatif terhadap hari ini. `all` memakai sentinel
 * `0000-01-01` … `9999-12-31` sehingga tidak pernah membatasi hasil.
 */
export function rangePresets(now: Date = today()): Record<RangePresetId, RangePreset> {
  const y = now.getFullYear();
  const monthStart = startOfMonth(now);
  const lastMonth = new Date(y, now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(y, now.getMonth(), 0);
  const week = isoWeekRange(now);
  const weekNo = isoWeekNumber(now);
  const q = Math.floor(now.getMonth() / 3) + 1;

  return {
    custom: { id: "custom", label: "Rentang Kustom", range: defaultRange() },
    today: { id: "today", label: `Hari Ini (${fmtDateShort(toISODate(now))})`, range: { from: toISODate(now), to: toISODate(now) } },
    week: { id: "week", label: `Minggu Ini (W${weekNo} ${y})`, range: week },
    month: { id: "month", label: `Bulan Ini (${MONTHS_LONG[now.getMonth()]} ${y})`, range: { from: toISODate(monthStart), to: toISODate(now) } },
    lastMonth: {
      id: "lastMonth",
      label: `Bulan Lalu (${MONTHS_LONG[lastMonth.getMonth()]} ${y})`,
      range: { from: toISODate(lastMonth), to: toISODate(lastMonthEnd) },
    },
    quarter: {
      id: "quarter",
      label: `Kuartal ${q} (Q${q} ${y})`,
      range: { from: toISODate(startOfQuarter(now)), to: toISODate(now) },
    },
    ytd: { id: "ytd", label: `Tahun Berjalan (YTD ${y})`, range: { from: toISODate(startOfYear(now)), to: toISODate(now) } },
    all: { id: "all", label: "Semua Tanggal", range: { from: "0000-01-01", to: "9999-12-31" } },
  };
}

function isoWeekNumber(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** Jaga agar `from` tidak melewati `to` dan keduanya selalu valid. */
export function normalizeRange(range: DateRange): DateRange {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(range.from) ? range.from : defaultRange().from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(range.to) ? range.to : defaultRange().to;
  return from <= to ? { from, to } : { from: to, to: from };
}

export function isSameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** "01 Okt 2026 – 31 Okt 2026" */
export function labelRange(r: DateRange): string {
  return `${fmtDateShort(r.from)} – ${fmtDateShort(r.to)}`;
}

/** Rentang satu bulan penuh dari month key "2026-10" → 01–31 Okt 2026. */
export function monthRange(monthKey: string): DateRange {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(last).padStart(2, "0")}`,
  };
}

/** Label periode ringkas untuk chip ringkasan: "Okt 2026" atau "Sep – Okt 2026". */
export function labelPeriod(r: DateRange): string {
  const f = fromISODate(r.from);
  const t = fromISODate(r.to);
  const sameYear = f.getFullYear() === t.getFullYear();
  if (f.getMonth() === t.getMonth() && sameYear) return `${MONTHS_SHORT[f.getMonth()]} ${f.getFullYear()}`;
  if (sameYear) return `${MONTHS_SHORT[f.getMonth()]} – ${MONTHS_SHORT[t.getMonth()]} ${t.getFullYear()}`;
  return `${MONTHS_SHORT[f.getMonth()]} ${f.getFullYear()} – ${MONTHS_SHORT[t.getMonth()]} ${t.getFullYear()}`;
}

export { MONTHS_SHORT, MONTHS_LONG, DAYS_SHORT };