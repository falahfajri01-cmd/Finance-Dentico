import { SEED_PNL, type PnlLine } from "./pnl";

/* ────────────────────────────────────────────────────────────────────
 * P&L Repository — per-account period postings produced by the
 * ledger aggregation engine.
 * ──────────────────────────────────────────────────────────────────── */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchPnlLines(): Promise<{ data: PnlLine[]; source: "supabase" | "demo" }> {
  await wait(420);
  return { data: SEED_PNL.items, source: "demo" };
}
