import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { SEED_PNL, type PnlLine } from "./pnl";

/* ────────────────────────────────────────────────────────────────────
 * P&L Repository — per-account period postings produced by the
 * ledger aggregation engine.
 *
 * In Supabase mode the amounts come from `pnl_account_postings`. The
 * bundled seed is still used for display metadata (row order, custom
 * `label`s) and as the one-time auto-seed when the table is empty,
 * so the statement layout is identical in both modes.
 * ──────────────────────────────────────────────────────────────────── */

const TABLE = "pnl_account_postings";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rebuild a report line, keeping the seed's display metadata. */
function toLine(code: string, amounts: Record<string, number>, tag?: string | null): PnlLine {
  const base = SEED_PNL.items.find((it) => it.code === code);
  const label = base?.label ?? tag ?? undefined;
  return {
    code,
    amounts,
    ...(label ? { label } : {}),
    sec: base?.sec ?? "",
  };
}

function autoSeed(): PnlLine[] {
  return SEED_PNL.items.map((it) => toLine(it.code, { ...it.amounts }, null));
}

export async function fetchPnlLines(): Promise<{ data: PnlLine[]; source: "supabase" | "demo" }> {
  if (isSupabaseEnabled && supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("code, period, amount, tag")
        .order("seq", { ascending: true })
        .order("code", { ascending: true });

      if (!error && data && data.length > 0) {
        const grouped = new Map<string, { amounts: Record<string, number>; tag: string | null }>();
        for (const row of data) {
          const code = String(row.code);
          const entry = grouped.get(code) ?? { amounts: {}, tag: null };
          entry.amounts[String(row.period)] = Number(row.amount);
          entry.tag = row.tag ?? entry.tag;
          grouped.set(code, entry);
        }
        // Preserve the seed's row ordering so totals and drill-downs line up.
        const order = new Map(SEED_PNL.items.map((it, i) => [it.code, i]));
        const lines = [...grouped.entries()]
          .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
          .map(([code, { amounts, tag }]) => toLine(code, amounts, tag));
        return { data: lines, source: "supabase" };
      }

      // Empty table → seed it once so the first run "just works".
      if (!error && data && data.length === 0) {
        const rows = SEED_PNL.items.flatMap((it) =>
          Object.entries(it.amounts).map(([period, amount]) => ({
            code: it.code,
            period,
            amount,
            tag: it.label ?? null,
          })),
        );
        const { error: seedErr } = await supabase
          .from(TABLE)
          .upsert(rows, { onConflict: "code,period" });
        if (seedErr) console.warn("[pnl] auto-seed failed:", seedErr.message);
        return { data: autoSeed(), source: "supabase" };
      }

      console.warn("[pnl] Supabase read failed, using demo postings:", error?.message);
    } catch (e) {
      console.warn("[pnl] Supabase unreachable, using demo postings.", e);
    }
  }
  await wait(420);
  return { data: SEED_PNL.items, source: "demo" };
}
