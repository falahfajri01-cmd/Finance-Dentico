import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { SEED_JOURNALS, sortJournals, type Journal, type JournalLine } from "./journal";

/* ────────────────────────────────────────────────────────────────────
 * Journal Repository — Supabase (`journals` + `journal_lines`) or
 * demo fallback (seed mirrored to localStorage).
 * ──────────────────────────────────────────────────────────────────── */

/* v3: baris akun mengikuti COA klinik resmi Anda (1107/2109/6402/…) */
const LS_KEY = "dentico.journals.v3";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let memoryCache: Journal[] | null = null;

/* ── Cross-module change notifications (e.g. Buku Besar listens) ──── */
export type JournalListener = () => void;
const listeners = new Set<JournalListener>();

export function onJournalsChanged(cb: JournalListener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notifyChanged() {
  listeners.forEach((l) => {
    try { l(); } catch { /* listener errors are isolated */ }
  });
}

/* ── Row mapping ───────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Journal {
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    type: r.journal_type,
    brand: r.brand,
    branch: r.branch,
    reference: r.reference ?? "",
    description: r.description ?? "",
    total: Number(r.total),
    status: r.status,
    operatorName: r.operator_name,
    operatorRole: r.operator_role ?? "",
    operatorInitials: r.operator_initials ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lines: ((r.journal_lines ?? []) as any[])
      .sort((a, b) => a.line_no - b.line_no)
      .map((l): JournalLine => ({
        accountCode: l.account_code,
        accountName: l.account_name,
        memo: l.memo ?? "",
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
  };
}

function journalToRow(j: Journal) {
  return {
    number: j.number,
    date: j.date,
    journal_type: j.type,
    brand: j.brand,
    branch: j.branch,
    reference: j.reference,
    description: j.description,
    total: j.total,
    status: j.status,
    operator_name: j.operatorName,
    operator_role: j.operatorRole,
    operator_initials: j.operatorInitials,
  };
}

/* ── Local persistence ─────────────────────────────────────────────── */
function loadLocal(): Journal[] {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Journal[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch { /* reseed */ }
  memoryCache = [...SEED_JOURNALS].sort(sortJournals);
  return memoryCache;
}

function persistLocal(next: Journal[]) {
  memoryCache = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* noop */ }
}

/* ── Public API ────────────────────────────────────────────────────── */
export async function fetchJournals(): Promise<{ data: Journal[]; source: "supabase" | "demo" }> {
  if (isSupabaseEnabled && supabase) {
    try {
      const { data, error } = await supabase
        .from("journals")
        .select("*, journal_lines(*)")
        .order("number", { ascending: false });
      if (!error && data && data.length > 0) {
        memoryCache = data.map(fromRow).sort(sortJournals);
        return { data: memoryCache, source: "supabase" };
      }
      if (!error && data && data.length === 0) {
        await seedSupabase();
        memoryCache = [...SEED_JOURNALS].sort(sortJournals);
        return { data: memoryCache, source: "supabase" };
      }
      console.warn("[journal] Supabase read failed, using demo journals:", error?.message);
    } catch (e) {
      console.warn("[journal] Supabase unreachable, using demo journals.", e);
    }
  }
  await wait(500);
  return { data: loadLocal(), source: "demo" };
}

/** Insert or fully replace a journal (header + lines). */
export async function saveJournal(journal: Journal, all: Journal[]): Promise<Journal> {
  if (isSupabaseEnabled && supabase) {
    try {
      const { error: e1 } = await supabase
        .from("journals")
        .upsert({ id: journal.id.startsWith("j-") || journal.id.startsWith("imp-") ? undefined : journal.id, ...journalToRow(journal) }, { onConflict: "number" });
      if (e1) throw new Error(e1.message);
      await replaceLines(journal.number, journal.lines);
    } catch (e) {
      console.warn("[journal] Supabase save failed, persisting locally.", e);
    }
  }
  const next = all.some((x) => x.id === journal.id)
    ? all.map((x) => (x.id === journal.id ? journal : x))
    : [journal, ...all];
  persistLocal(next.sort(sortJournals));
  notifyChanged();
  return journal;
}

export async function deleteJournal(id: string, all: Journal[]): Promise<Journal[]> {
  const target = all.find((j) => j.id === id);
  if (isSupabaseEnabled && supabase && target) {
    try {
      await supabase.from("journals").delete().eq("number", target.number);
    } catch { /* ignore */ }
  }
  const next = all.filter((j) => j.id !== id);
  persistLocal(next);
  notifyChanged();
  return next;
}

export async function updateStatus(
  id: string, status: Journal["status"], all: Journal[]
): Promise<Journal | null> {
  const target = all.find((j) => j.id === id);
  if (!target) return null;
  const updated = { ...target, status };
  if (isSupabaseEnabled && supabase) {
    try {
      await supabase.from("journals").update({ status }).eq("number", target.number);
    } catch { /* ignore */ }
  }
  persistLocal(all.map((j) => (j.id === id ? updated : j)).sort(sortJournals));
  notifyChanged();
  return updated;
}

/* ── Supabase helpers ──────────────────────────────────────────────── */
async function replaceLines(journalNumber: string, lines: JournalLine[]) {
  if (!supabase) return;
  const { data: j } = await supabase.from("journals").select("id").eq("number", journalNumber).single();
  if (!j) return;
  await supabase.from("journal_lines").delete().eq("journal_id", j.id);
  if (lines.length > 0) {
    await supabase.from("journal_lines").insert(
      lines.map((l, i) => ({
        journal_id: j.id,
        line_no: i + 1,
        account_code: l.accountCode,
        account_name: l.accountName,
        memo: l.memo,
        debit: l.debit,
        credit: l.credit,
      }))
    );
  }
}

async function seedSupabase() {
  if (!supabase) return;
  for (const j of SEED_JOURNALS) {
    try {
      await supabase.from("journals").upsert(journalToRow(j), { onConflict: "number" });
      await replaceLines(j.number, j.lines);
    } catch { /* continue seeding best-effort */ }
  }
}
