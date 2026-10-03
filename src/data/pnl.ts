import seedData from "./pnl.seed.json";
import type { CoaAccount } from "./coa";
import type { Journal } from "./journal";

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

export type PnlPeriod = "2026-09" | "2026-08" | "2026-07" | "Q3";

export interface PnlLine {
  code: string;
  /** Optional custom display name for analytical rows not present in COA */
  label?: string;
  sec: string;           // "pendapatan" | "langsung" | "sdm" | "ops" | ...
  amounts: Record<string, number>;
}

interface PnlSeed { periods: string[]; items: PnlLine[] }

export const SEED_PNL: PnlSeed = seedData as unknown as PnlSeed;

export const PNL_PERIODS: { key: PnlPeriod; label: string }[] = [
  { key: "2026-09", label: "September 2026 (Aktif)" },
  { key: "2026-08", label: "Agustus 2026" },
  { key: "2026-07", label: "Juli 2026" },
  { key: "Q3", label: "Q3 2026 (YTD)" },
];

export function amountOf(line: PnlLine, period: PnlPeriod): number {
  if (period === "Q3") {
    return (line.amounts["2026-07"] ?? 0) + (line.amounts["2026-08"] ?? 0) + (line.amounts["2026-09"] ?? 0);
  }
  return line.amounts[period] ?? 0;
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
 * Filter journals by entity/branch and rebuild PnlLine items.
 * Used to ensure Overview and P&L pages show identical numbers.
 */
export function getScopedPnlLines(
  baseLines: PnlLine[],
  journals: Journal[],
  entity: string,
  branch: string,
): PnlLine[] {
  const isConsolidated = entity === "Dentico Group (Consolidated)" && branch === "Semua Cabang (Grup)";
  if (isConsolidated) return baseLines;

  const byCodePeriod = new Map<string, number>();
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

  const periodOf = (d: string) => d.startsWith("2026-09") ? "2026-09" : d.startsWith("2026-08") ? "2026-08" : d.startsWith("2026-07") ? "2026-07" : null;

  for (const j of journals) {
    if (j.status !== "POSTED") continue;
    if (!matchesEntity(j) || !matchesBranch(j)) continue;
    const p = periodOf(j.date);
    if (!p) continue;
    for (const l of j.lines) {
      let delta = 0;
      if (l.accountCode.startsWith("4")) delta = l.credit - l.debit;
      else if (l.accountCode.startsWith("5") || l.accountCode.startsWith("6")) delta = l.debit - l.credit;
      else continue;
      const key = `${l.accountCode}:${p}`;
      byCodePeriod.set(key, (byCodePeriod.get(key) ?? 0) + delta);
    }
  }

  return baseLines.map((line) => ({
    ...line,
    amounts: {
      "2026-07": byCodePeriod.get(`${line.code}:2026-07`) ?? 0,
      "2026-08": byCodePeriod.get(`${line.code}:2026-08`) ?? 0,
      "2026-09": byCodePeriod.get(`${line.code}:2026-09`) ?? 0,
    },
  }));
}

export function computeStatement(
  items: PnlLine[],
  accounts: CoaAccount[],
  period: PnlPeriod,
): PnlStatement {
  const nameOf = (code: string) => accounts.find((a) => a.code === code)?.name ?? code;

  const sections: PnlSection[] = SECTION_DEFS.map((def) => {
    const rows: PnlRow[] = def.codes.map((code) => {
      const line = items.find((it) => it.code === code);
      const amount = line ? amountOf(line, period) : 0;
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
