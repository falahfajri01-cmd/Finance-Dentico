import seedData from "./ledger.seed.json";
import type { Journal } from "./journal";
import type { CoaAccount } from "./coa";

/* ────────────────────────────────────────────────────────────────────
 * General Ledger domain — derived from posted journals (registry)
 * merged with immutable integrity-verified supplement postings.
 * ──────────────────────────────────────────────────────────────────── */
export type GlBukti = "receipt" | "attach" | "verified" | "doc" | "lock";

export interface GlSupplement {
  id: string;
  accountCode: string;
  date: string;        // ISO
  time: string;        // "14:15"
  voucher: string;
  ref: string;
  branch: string;
  dot: "primary" | "tertiary";
  description: string;
  subDescription?: string;
  offsetLabel: string;
  debit: number;
  credit: number;
  bukti: GlBukti;
  memo?: string;
}

export interface GlEntry extends Omit<GlSupplement, "id" | "accountCode"> {
  id: string;
  runningBalance: number;
  source: "journal" | "supplement";
  /** true when derived from a REVIEW/APPROVED journal (pending audit) */
  pending?: boolean;
  /** the backing journal when derived from the registry */
  journal?: Journal;
}

interface LedgerSeed {
  openingBalances: Record<string, number>;
  supplements: GlSupplement[];
}

const SEED = seedData as LedgerSeed;

export const OPENING_BALANCES = SEED.openingBalances;
export const GL_SUPPLEMENTS = SEED.supplements;

/** Vouchers are compared normalized ("JV/2026/09/0142" ≡ "JV-2026/09/0142") */
const normVoucher = (v: string) => v.replace(/[^0-9A-Za-z]/g, "").toUpperCase();

export interface LedgerResult {
  entries: GlEntry[];
  opening: number;
  totalDebit: number;
  totalCredit: number;
  ending: number;
}

/**
 * Builds the running-balance ledger for one account.
 * Registry journals (POSTED) are merged in; a journal whose voucher matches
 * a supplement voucher is skipped (the richer supplement row wins — dedupe).
 */
export function buildLedger(
  account: CoaAccount | null,
  journals: Journal[],
  supplements: GlSupplement[],
  opts: { includePending?: boolean } = {}
): LedgerResult {
  if (!account) return { entries: [], opening: 0, totalDebit: 0, totalCredit: 0, ending: 0 };

  const suppForAccount = supplements.filter((s) => s.accountCode === account.code);
  const suppVouchers = new Set(suppForAccount.map((s) => normVoucher(s.voucher)));

  const raw: Omit<GlEntry, "runningBalance">[] = suppForAccount.map((s) => ({
    ...s,
    id: s.id,
    source: "supplement" as const,
  }));

  for (const j of journals) {
    const isPending = j.status === "REVIEW" || j.status === "APPROVED";
    if (j.status !== "POSTED" && !(opts.includePending && isPending)) continue;
    if (suppVouchers.has(normVoucher(j.number))) continue; // dedupe collision
    const mine = j.lines.filter((l) => l.accountCode === account.code);
    if (mine.length === 0) continue;
    const others = j.lines.filter((l) => l.accountCode !== account.code);
    const offsetLabel =
      others.length === 1
        ? `[${others[0].accountCode}] ${others[0].accountName}`
        : `Multi-akun (${others.length} baris)`;
    for (const l of mine) {
      raw.push({
        id: `${j.id}-l${j.lines.indexOf(l)}`,
        date: j.date,
        time: "12:00",
        voucher: j.number,
        ref: j.reference,
        branch: j.branch,
        dot: "primary",
        description: j.description || j.reference,
        subDescription: l.memo || undefined,
        offsetLabel,
        debit: l.debit,
        credit: l.credit,
        bukti: "verified",
        memo: j.description,
        source: "journal",
        pending: isPending,
        journal: j,
      });
    }
  }

  raw.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const opening = OPENING_BALANCES[account.code] ?? 0;
  const sign = account.normal === "Kredit" ? -1 : 1;
  let run = opening;
  let totalDebit = 0;
  let totalCredit = 0;
  const entries: GlEntry[] = raw.map((e) => {
    run += sign * (e.debit - e.credit);
    totalDebit += e.debit;
    totalCredit += e.credit;
    return { ...e, runningBalance: run };
  });

  return { entries, opening, totalDebit, totalCredit, ending: run };
}

/** Deterministic pseudo-hash for the audit lock stamp */
export function auditHash(code: string): string {
  let h = 0x8bfa9;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return `8bfa9…${(h % 0xffff).toString(16).padStart(4, "0")}`;
}
