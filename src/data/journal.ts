import seedData from "./journal.seed.json";

/* ────────────────────────────────────────────────────────────────────
 * Journal domain types — mirrors `journals` + `journal_lines` tables
 * ──────────────────────────────────────────────────────────────────── */
export type JournalStatus = "DRAFT" | "REVIEW" | "APPROVED" | "POSTED";
export type JournalType = "JU" | "JP" | "JB" | "KM" | "KK" | "BK" | "ADJ";

export interface JournalLine {
  accountCode: string;
  accountName: string;
  memo: string;
  debit: number;
  credit: number;
}

export interface Journal {
  id: string;
  number: string;          // "JV/2026/09/0142"
  date: string;            // ISO "2026-09-30"
  type: JournalType;
  brand: string;
  branch: string;
  reference: string;
  description: string;
  total: number;           // total debit (= total kredit saat balanced)
  status: JournalStatus;
  operatorName: string;
  operatorRole: string;
  operatorInitials: string;
  lines: JournalLine[];
}

export const SEED_JOURNALS: Journal[] = seedData as Journal[];

export const JOURNAL_TYPES: { code: JournalType; label: string }[] = [
  { code: "JU", label: "Jurnal Umum (General)" },
  { code: "JP", label: "Jurnal Penjualan (Revenue)" },
  { code: "JB", label: "Jurnal Pembelian (Expenses)" },
  { code: "KM", label: "Kas Masuk (Cash Receipt)" },
  { code: "KK", label: "Kas Keluar (Disbursement)" },
  { code: "BK", label: "Bank Entry" },
  { code: "ADJ", label: "Jurnal Penyesuaian (Adjustment)" },
];

export const JOURNAL_TYPE_SHORT: Record<JournalType, string> = {
  JU: "Jurnal Umum",
  JP: "Jurnal Penjualan",
  JB: "Jurnal Pembelian",
  KM: "Jurnal Kas Masuk",
  KK: "Jurnal Kas Keluar",
  BK: "Bank Entry",
  ADJ: "Penyesuaian",
};

export const STATUS_ORDER: JournalStatus[] = ["DRAFT", "REVIEW", "APPROVED", "POSTED"];

export const STATUS_STYLE: Record<JournalStatus, { chip: string; dot: string; animate?: boolean }> = {
  POSTED: { chip: "bg-emerald-500/15 text-emerald-800", dot: "bg-emerald-600" },
  REVIEW: { chip: "bg-amber-500/15 text-amber-800", dot: "bg-amber-500", animate: true },
  APPROVED: { chip: "bg-primary/10 text-primary", dot: "bg-primary" },
  DRAFT: { chip: "bg-surface-container-highest text-on-surface-variant", dot: "bg-outline" },
};

/* ── Helpers ───────────────────────────────────────────────────────── */
/** "JV/2026/09/0142" → "JV-0142" */
export function shortNumber(number: string): string {
  const seg = number.split("/");
  return `JV-${seg[seg.length - 1]}`;
}

/** "2026-09-30" → "30/09/2026" */
export function fmtDateId(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function isBalanced(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const c = lines.reduce((s, l) => s + (l.credit || 0), 0);
  return d > 0 && d === c;
}

export function totalOf(lines: JournalLine[]): { debit: number; credit: number } {
  return {
    debit: lines.reduce((s, l) => s + (l.debit || 0), 0),
    credit: lines.reduce((s, l) => s + (l.credit || 0), 0),
  };
}

/** Next journal number inside the active period prefix, e.g. JV/2026/09/0143 */
export function nextNumber(journals: Journal[], periodPrefix = "JV/2026/09/"): string {
  const max = journals
    .filter((j) => j.number.startsWith(periodPrefix))
    .reduce((m, j) => {
      const seg = j.number.slice(periodPrefix.length);
      return Math.max(m, parseInt(seg, 10) || 0);
    }, 0);
  return `${periodPrefix}${String(max + 1).padStart(4, "0")}`;
}

export function operatorColor(initials: string): string {
  const map: Record<string, string> = {
    FL: "bg-primary/15 text-primary",
    DM: "bg-secondary-container/20 text-secondary",
    NB: "bg-tertiary-container/30 text-tertiary",
    ST: "bg-emerald-500/15 text-emerald-700",
  };
  return map[initials] ?? "bg-surface-container-highest text-on-surface-variant";
}

export function sortJournals(a: Journal, b: Journal): number {
  return b.number.localeCompare(a.number); // newest number first
}
