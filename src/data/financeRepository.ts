import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { SEED_FINANCE, type FinanceBundle, type FinanceMonth } from "./finance";

/* ────────────────────────────────────────────────────────────────────
 * Finance Overview Repository — same Supabase-or-demo pattern as COA.
 * Read-only dataset (analytics snapshots posted by the ledger engine).
 * ──────────────────────────────────────────────────────────────────── */

const M_TABLE = "finance_monthly";
const META_TABLE = "finance_overview_meta";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function monthFromRow(r: any): FinanceMonth {
  return {
    id: r.id,
    label: r.month_label,
    labelLong: r.month_label_long ?? r.month_label,
    revenue: Number(r.revenue),
    hpp: Number(r.hpp),
    opex: Number(r.opex),
    netProfit: Number(r.net_profit),
  };
}

export async function fetchFinanceBundle(): Promise<{ data: FinanceBundle; source: "supabase" | "demo" }> {
  if (isSupabaseEnabled && supabase) {
    try {
      const [{ data: months, error: e1 }, { data: metaRows, error: e2 }] = await Promise.all([
        supabase.from(M_TABLE).select("*").order("id", { ascending: true }),
        supabase.from(META_TABLE).select("payload").limit(1),
      ]);
      if (!e1 && !e2 && months && months.length > 0 && metaRows && metaRows.length > 0) {
        return {
          data: { monthly: months.map(monthFromRow), meta: metaRows[0].payload },
          source: "supabase",
        };
      }
      console.warn("[finance] Supabase read failed or empty, using demo bundle:", e1?.message ?? e2?.message);
    } catch (e) {
      console.warn("[finance] Supabase unreachable, using demo bundle.", e);
    }
  }
  await wait(550);
  return { data: SEED_FINANCE, source: "demo" };
}
