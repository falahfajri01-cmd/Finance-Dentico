import seedData from "./coa.seed.json";

/* ────────────────────────────────────────────────────────────────────
 * Domain types — mirrors the `coa_accounts` table in Supabase
 * (struktur akun mengikuti COA resmi klinik: 108 akun posting + 6 header)
 * ──────────────────────────────────────────────────────────────────── */
export type NormalBalance = "Debit" | "Kredit";

export interface CoaAccount {
  id: string;
  code: string;
  name: string;
  /** Sub-type label, e.g. "Aset Lancar", "Biaya Gaji & SDM" */
  typeLabel: string;
  /** Top-level header group code: "1000".."6000" */
  group: string;
  parentCode: string | null;
  parentLabel: string | null;
  normal: NormalBalance;
  isHeader: boolean;
  canPost: boolean;
  isActive: boolean;
  /** Locked = has ledger history → protected from deletion */
  isLocked: boolean;
  txCount: number;
  updatedAt: string;
}

export const SEED_ACCOUNTS: CoaAccount[] = seedData as CoaAccount[];

/* ── Pillar (5 accounting pillars) ─────────────────────────────────── */
export type Pillar = "Aset" | "Liabilitas" | "Ekuitas" | "Pendapatan" | "HPP & Beban";

export const GROUP_META: Record<string, { name: string; pillar: Pillar }> = {
  "1000": { name: "ASET", pillar: "Aset" },
  "2000": { name: "LIABILITAS", pillar: "Liabilitas" },
  "3000": { name: "EKUITAS", pillar: "Ekuitas" },
  "4000": { name: "PENDAPATAN", pillar: "Pendapatan" },
  "5000": { name: "HPP — HARGA POKOK PENJUALAN", pillar: "HPP & Beban" },
  "6000": { name: "BEBAN USAHA", pillar: "HPP & Beban" },
};

export const GROUP_ORDER = Object.keys(GROUP_META);

export function pillarOf(account: CoaAccount): Pillar {
  return GROUP_META[account.group]?.pillar ?? "HPP & Beban";
}

/** Text color used for the account code, tinted per pillar */
export const PILLAR_CODE_COLOR: Record<Pillar, string> = {
  Aset: "text-primary",
  Liabilitas: "text-secondary",
  Ekuitas: "text-tertiary",
  Pendapatan: "text-emerald-700",
  "HPP & Beban": "text-amber-700",
};

export const PILLAR_CHIP_CLASSES: Record<Pillar, string> = {
  Aset: "bg-primary/10 text-primary",
  Liabilitas: "bg-secondary/10 text-secondary",
  Ekuitas: "bg-tertiary/10 text-tertiary",
  Pendapatan: "bg-emerald-500/10 text-emerald-700",
  "HPP & Beban": "bg-amber-500/10 text-amber-700",
};

/* ── Category tabs ─────────────────────────────────────────────────── */
export type TabKey =
  | "all" | "aset" | "liabilitas" | "ekuitas" | "pendapatan"
  | "hpp" | "langsung" | "sdm" | "ops" | "marketing";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Semua Akun" },
  { key: "aset", label: "Aset" },
  { key: "liabilitas", label: "Liabilitas" },
  { key: "ekuitas", label: "Ekuitas" },
  { key: "pendapatan", label: "Pendapatan" },
  { key: "hpp", label: "HPP" },
  { key: "langsung", label: "Biaya Langsung" },
  { key: "sdm", label: "Biaya SDM" },
  { key: "ops", label: "Biaya Ops" },
  { key: "marketing", label: "Marketing & Lainnya" },
];

/** Maps an account to its tab (6xxx beban groups differentiate by code range) */
export function tabOf(account: CoaAccount): TabKey {
  switch (account.group) {
    case "1000": return "aset";
    case "2000": return "liabilitas";
    case "3000": return "ekuitas";
    case "4000": return "pendapatan";
    case "5000": return "hpp";
    case "6000": {
      const p2 = account.code.slice(0, 2);
      if (p2 === "60") return "langsung";
      if (p2 === "61") return "sdm";
      if (p2 === "62" || p2 === "63" || p2 === "64") return "ops";
      return "marketing"; // 65xx / 66xx
    }
    default:
      return "all";
  }
}

/* ── Misc helpers ──────────────────────────────────────────────────── */
export const sortByCode = (a: CoaAccount, b: CoaAccount) => a.code.localeCompare(b.code);

export function fmtCount(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Suggest the next available numeric code inside a header group */
export function suggestNextCode(accounts: CoaAccount[], group: string): string {
  const max = accounts
    .filter((a) => !a.isHeader && a.group === group)
    .reduce((m, a) => Math.max(m, parseInt(a.code, 10) || 0), parseInt(group, 10));
  return String(max + 1);
}

/** Default normal balance for a group (aset/beban debit, lainnya kredit) */
export function defaultNormalFor(group: string): NormalBalance {
  const pillar = GROUP_META[group]?.pillar;
  if (pillar === "Aset" || pillar === "HPP & Beban") return "Debit";
  return "Kredit";
}
