import { supabase, isSupabaseEnabled, SUPABASE_TABLE } from "../lib/supabase";
import { SEED_ACCOUNTS, sortByCode, type CoaAccount } from "./coa";

/* ────────────────────────────────────────────────────────────────────
 * COA Repository
 *
 * Single data-access layer. If Supabase credentials are configured it
 * talks to the `coa_accounts` table; otherwise it serves the bundled
 * dummy dataset (mirrored to localStorage so edits survive reloads).
 * ──────────────────────────────────────────────────────────────────── */

/* v3: struktur COA resmi klinik Anda (108 posting + 6 header) */
const LS_KEY = "dentico.coa.v3";
let memoryCache: CoaAccount[] | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Row mapping (snake_case table ↔ camelCase domain) ────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): CoaAccount {
  return {
    id: r.id ?? `a-${r.code}`,
    code: r.code,
    name: r.name,
    typeLabel: r.type_label ?? "",
    group: r.group_code,
    parentCode: r.parent_code ?? null,
    parentLabel: r.parent_label ?? null,
    normal: r.normal,
    isHeader: !!r.is_header,
    canPost: !!r.can_post,
    isActive: !!r.is_active,
    isLocked: !!r.is_locked,
    txCount: r.tx_count ?? 0,
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

function toRow(a: CoaAccount) {
  return {
    code: a.code,
    name: a.name,
    type_label: a.typeLabel,
    group_code: a.group,
    parent_code: a.parentCode,
    parent_label: a.parentLabel,
    normal: a.normal,
    is_header: a.isHeader,
    can_post: a.canPost,
    is_active: a.isActive,
    is_locked: a.isLocked,
    tx_count: a.txCount,
    updated_at: a.updatedAt,
  };
}

/* ── Local (demo) persistence ──────────────────────────────────────── */
function loadLocal(): CoaAccount[] {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CoaAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch {
    /* corrupted cache → reseed */
  }
  memoryCache = [...SEED_ACCOUNTS].sort(sortByCode);
  return memoryCache;
}

function persistLocal(next: CoaAccount[]) {
  memoryCache = next;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* storage full / private mode — keep in-memory only */
  }
}

/* ── Public API ────────────────────────────────────────────────────── */

/** Fetch all accounts, ordered by code. */
export async function fetchAccounts(): Promise<{ data: CoaAccount[]; source: "supabase" | "demo" }> {
  if (isSupabaseEnabled && supabase) {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select("*")
        .order("code", { ascending: true });
      if (!error && data && data.length > 0) {
        memoryCache = data.map(fromRow);
        return { data: memoryCache, source: "supabase" };
      }
      // Empty table → seed it once so first run "just works"
      if (!error && data && data.length === 0) {
        await supabase.from(SUPABASE_TABLE).upsert(SEED_ACCOUNTS.map(toRow), { onConflict: "code" });
        memoryCache = [...SEED_ACCOUNTS].sort(sortByCode);
        return { data: memoryCache, source: "supabase" };
      }
      console.warn("[coa] Supabase read failed, falling back to demo data:", error?.message);
    } catch (e) {
      console.warn("[coa] Supabase unreachable, using demo data.", e);
    }
  }
  await wait(650); // simulate network latency for the demo skeleton
  return { data: loadLocal(), source: "demo" };
}

/** Insert or update one account. Returns the saved account. */
export async function upsertAccount(account: CoaAccount, all: CoaAccount[]): Promise<CoaAccount> {
  const saved = { ...account, updatedAt: new Date().toISOString() };
  if (isSupabaseEnabled && supabase) {
    const { error } = await supabase.from(SUPABASE_TABLE).upsert(toRow(saved), { onConflict: "code" });
    if (error) throw new Error(error.message);
  }
  const next = all.some((a) => a.id === saved.id)
    ? all.map((a) => (a.id === saved.id ? saved : a))
    : [...all, saved];
  persistLocal(next.sort(sortByCode));
  return saved;
}

/** Import many accounts at once (CSV import). */
export async function bulkUpsert(accounts: CoaAccount[], all: CoaAccount[]): Promise<CoaAccount[]> {
  if (isSupabaseEnabled && supabase) {
    const { error } = await supabase.from(SUPABASE_TABLE).upsert(accounts.map(toRow), { onConflict: "code" });
    if (error) throw new Error(error.message);
  }
  const byId = new Map(all.map((a) => [a.id, a] as const));
  for (const a of accounts) byId.set(a.id, a);
  const next = [...byId.values()].sort(sortByCode);
  persistLocal(next);
  return next;
}

/** Reset demo data back to the factory seed (demo mode helper). */
export function resetDemoData() {
  localStorage.removeItem(LS_KEY);
  memoryCache = null;
}
