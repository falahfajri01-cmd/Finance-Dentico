import seedData from "./pnl.seed.json";
import type { CoaAccount } from "./coa";
import type { Journal } from "./journal";
import {
  buildPeriodOptions, deriveMonths, labelOfPeriod, monthKeyOf, monthsInPeriod,
  type MonthKey, type PeriodKey, type PeriodOption,
} from "../utils/periods";

/* ────────────────────────────────────────────────────────────────────
 * Laporan Laba Rugi (Income Statement) domain
 *
 * Struktur mengikuti format laporan klinik resmi:
 *   PENDAPATAN USAHA
 *   BIAYA LANGSUNG
 *   ─── LABA KOTOR ───
 *   BEBAN OPERASIONAL
 *     · Biaya Gaji & SDM
 *     · Biaya Operasional
 *     · Biaya Pemeliharaan
 *     · Biaya Administrasi
 *     · Biaya Marketing
 *   ─── TOTAL BEBAN OPERASIONAL ───
 *   ─── LABA OPERASIONAL ───
 *   PENDAPATAN / BEBAN NON-OPERASIONAL
 *   ─── LABA BERSIH ───
 * ──────────────────────────────────────────────────────────────────── */

export type PnlPeriod = PeriodKey;

export interface PnlLine {
  code: string;
  /** Optional custom display name for analytical rows not present in COA */
  label?: string;
  sec: string;           // "pendapatan" | "langsung" | "sdm" | "ops" | ...
  amounts: Record<string, number>;
}

interface PnlSeed { periods: string[]; items: PnlLine[] }

export const SEED_PNL: PnlSeed = seedData as unknown as PnlSeed;

/**
 * Opsi periode Laba Rugi. Diturunkan dari jurnal yang ada + periode pada
 * tabel postings + bulan berjalan, jadi jurnal baru langsung membuka
 * periode barunya (mis. "2026-10" setelah ada jurnal Oktober).
 */
export function pnlPeriodOptions(journals: Journal[], baseLines: PnlLine[] = []): PeriodOption[] {
  const months = deriveMonths({
    dates: journals.map((j) => j.date),
    keys: baseLines.flatMap((l) => Object.keys(l.amounts)),
  });
  return buildPeriodOptions(months);
}

export function pnlPeriodMonths(journals: Journal[], baseLines: PnlLine[] = []): MonthKey[] {
  return deriveMonths({
    dates: journals.map((j) => j.date),
    keys: baseLines.flatMap((l) => Object.keys(l.amounts)),
  });
}

export { labelOfPeriod };

/** Jumlah satu baris pada periode mana pun (bulan, kuartal, atau YTD). */
export function amountOf(line: PnlLine, period: PnlPeriod, months: MonthKey[] = []): number {
  if (months.length > 0) {
    return monthsInPeriod(period, months).reduce((s, m) => s + (line.amounts[m] ?? 0), 0);
  }
  if (isAggregatePeriod(period)) {
    return Object.entries(line.amounts)
      .filter(([m]) => monthsInPeriod(period, [m]).length > 0)
      .reduce((s, [, v]) => s + (v ?? 0), 0);
  }
  return line.amounts[period] ?? 0;
}

/** true untuk periode agregat (kuartal "2026-Q4" atau YTD "2026-YTD"). */
export function isAggregatePeriod(period: string): boolean {
  return !/^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

/* ── Section definitions (match screenshot structure exactly) ──────── */
export type SectionKey =
  | "pendapatan" | "langsung"
  | "sdm" | "ops" | "maint" | "adm" | "mkt"
  | "nonops";

export interface SectionDef {
  key: SectionKey;
  title: string;
  /** Colour accent for the section header */
  color: "primary" | "amber" | "emerald" | "default";
  /** true = items indented one more level (sub-section of Beban Operasional) */
  isBebanChild: boolean;
  codes: string[];
}

/** The top-level sections in display order */
export const SECTION_DEFS: SectionDef[] = [
  {
    key: "pendapatan", title: "PENDAPATAN USAHA", color: "primary", isBebanChild: false,
    codes: ["4101", "4201", "4202", "4301"],
  },
  {
    key: "langsung", title: "BIAYA LANGSUNG", color: "amber", isBebanChild: false,
    codes: ["6001", "6002", "6003", "6004"],
  },
  /* ── children of BEBAN OPERASIONAL ───────────────────────── */
  {
    key: "sdm", title: "BIAYA GAJI & SDM", color: "default", isBebanChild: true,
    codes: ["6102", "6103", "6104", "6105", "6106", "6107", "6108", "6109", "6110"],
  },
  {
    key: "ops", title: "BIAYA OPERASIONAL", color: "default", isBebanChild: true,
    codes: ["6201", "6202", "6203", "6204", "6205", "6206", "6207", "6208", "6209", "6210", "6211", "6212", "6213", "6214", "6215", "6216", "6217", "6218"],
  },
  {
    key: "maint", title: "BIAYA PEMELIHARAAN", color: "default", isBebanChild: true,
    codes: ["6301", "6302", "6303", "6304", "6305"],
  },
  {
    key: "adm", title: "BIAYA ADMINISTRASI", color: "default", isBebanChild: true,
    codes: ["6401", "6402", "6403", "6404", "6405", "6406", "6407", "6408"],
  },
  {
    key: "mkt", title: "BIAYA MARKETING", color: "default", isBebanChild: true,
    codes: ["6501", "6502", "6503", "6504", "6505", "6506"],
  },
  /* ── non-operational ─────────────────────────────────────── */
  {
    key: "nonops", title: "PENDAPATAN / BEBAN NON-OPERASIONAL", color: "default", isBebanChild: false,
    codes: ["4302", "6601", "6602", "6603"],
  },
];

export const BEBAN_CHILDREN: SectionKey[] = ["sdm", "ops", "maint", "adm", "mkt"];

/* ── Computed row & section types ──────────────────────────────────── */
export interface PnlRow {
  code: string;
  name: string;
  amount: number;
  isIncome: boolean;      // true → positive contribution (non-ops income 4302)
  /** false for analytical lines that don't exist in COA / GL */
  drillable: boolean;
}

export interface PnlSection extends SectionDef {
  rows: PnlRow[];
  total: number;
}

export interface PnlStatement {
  sections: PnlSection[];
  pendapatan: number;       // Total Pendapatan
  biayaLangsung: number;    // Total Beban Langsung
  labaKotor: number;        // = Pendapatan − Biaya Langsung
  bebanOps: number;         // Total Beban Operasional (sum of 5 sub-sections)
  labaOperasional: number;  // = Laba Kotor − Total Beban Operasional
  nonOpsNet: number;        // net of non-ops section (income − expenses)
  labaBersih: number;       // = Laba Operasional + Non-Ops Net
}

/**
 * Bangun `amounts` untuk setiap bulan yang tersedia.
 *
 * Periode yang sudah punya snapshot resmi di `pnl_account_postings`
 * (mis. Jul–Sep) memakai nilai tabel itu agar angka tidak berubah; bulan
 * baru yang belum ada di tabel — misalnya Oktober setelah jurnal diinput —
 * dihitung langsung dari jurnal POSTED.
 */
function applyJournalMonths(
  baseLines: PnlLine[],
  journals: Journal[],
  entity: string,
  branch: string,
  months: MonthKey[],
  replaceAll: boolean,
): PnlLine[] {
  const matchesEntity = (j: Journal) =>
    entity === "Dentico Group (Consolidated)" || j.brand.toLowerCase().includes(entity.toLowerCase().split(" - ")[0].toLowerCase());

  const matchesBranch = (j: Journal) => {
    if (branch === "Semua Cabang (Grup)") return true;
    const scope = j.branch.toLowerCase().includes(j.brand.toLowerCase())
      ? j.branch.toLowerCase()
      : `${j.brand} - ${j.branch}`.toLowerCase();
    const tokens = branch.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.every((t) => scope.includes(t));
  };

  const byCodePeriod = new Map<string, number>();
  for (const j of journals) {
    if (j.status !== "POSTED") continue;
    if (!matchesEntity(j) || !matchesBranch(j)) continue;
    const p = monthKeyOf(j.date);
    for (const l of j.lines) {
      let delta = 0;
      if (l.accountCode.startsWith("4")) delta = l.credit - l.debit;
      else if (l.accountCode.startsWith("5") || l.accountCode.startsWith("6")) delta = l.debit - l.credit;
      else continue;
      const key = `${l.accountCode}:${p}`;
      byCodePeriod.set(key, (byCodePeriod.get(key) ?? 0) + delta);
    }
  }

  return baseLines.map((line) => {
    const amounts: Record<string, number> = {};
    for (const m of months) {
      const derived = byCodePeriod.get(`${line.code}:${m}`) ?? 0;
      const hasSnapshot = line.amounts[m] !== undefined;
      amounts[m] = hasSnapshot && !replaceAll ? line.amounts[m] : derived;
    }
    return { ...line, amounts };
  });
}

/**
 * Filter journals by entity/branch and rebuild PnlLine items.
 *
 * `replaceAll` (mode scoped) mengganti semua angka dengan turunan jurnal.
 *_mode konsolidasi_ mempertahankan snapshot `pnl_account_postings` untuk
 * periode yang sudah ada, dan hanya mengisi bulan yang belum punya snapshot.
 */
export function getScopedPnlLines(
  baseLines: PnlLine[],
  journals: Journal[],
  entity: string,
  branch: string,
  months?: MonthKey[],
): PnlLine[] {
  const isConsolidated = entity === "Dentico Group (Consolidated)" && branch === "Semua Cabang (Grup)";
  return applyJournalMonths(
    baseLines, journals, entity, branch,
    months ?? pnlPeriodMonths(journals, baseLines),
    !isConsolidated,
  );
}

export function computeStatement(
  items: PnlLine[],
  accounts: CoaAccount[],
  period: PnlPeriod,
  months?: MonthKey[],
): PnlStatement {
  const nameOf = (code: string) => accounts.find((a) => a.code === code)?.name ?? code;

  const sections: PnlSection[] = SECTION_DEFS.map((def) => {
    const rows: PnlRow[] = def.codes.map((code) => {
      const line = items.find((it) => it.code === code);
      const amount = line ? amountOf(line, period, months) : 0;
      const isIncome = code.startsWith("4");
      const existsInCoa = accounts.some((a) => a.code === code);
       return {
        code,
        name: line?.label ?? nameOf(code),
        amount,
        isIncome,
        drillable: existsInCoa,
      };
    });

    let total: number;
    if (def.key === "nonops") {
      // Non-ops: income codes positive, expense codes negative
      total = rows.reduce((s, r) => s + (r.isIncome ? r.amount : -r.amount), 0);
    } else if (def.key === "pendapatan") {
      total = rows.reduce((s, r) => s + r.amount, 0);
    } else {
      // All expense sections: sum of amounts
      total = rows.reduce((s, r) => s + r.amount, 0);
    }

    return { ...def, rows, total };
  });

  const sec = (k: SectionKey) => sections.find((s) => s.key === k)!;

  const pendapatan = sec("pendapatan").total;
  const biayaLangsung = sec("langsung").total;
  const labaKotor = pendapatan - biayaLangsung;

  const bebanOps = BEBAN_CHILDREN.reduce((s, k) => s + sec(k).total, 0);
  const labaOperasional = labaKotor - bebanOps;

  const nonOpsNet = sec("nonops").total; // already net (income − expenses)
  const labaBersih = labaOperasional + nonOpsNet;

  return { sections, pendapatan, biayaLangsung, labaKotor, bebanOps, labaOperasional, nonOpsNet, labaBersih };
}
