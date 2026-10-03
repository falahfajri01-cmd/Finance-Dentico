import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FileDown, FileUp, Plus } from "lucide-react";

import MetricsRibbon from "./MetricsRibbon";
import FilterBar, { type LevelFilter, type StatusFilter } from "./FilterBar";
import CoaTable, { type DisplayRow } from "./CoaTable";
import DetailPanel from "./DetailPanel";
import AddAccountModal, { type AddPayload } from "./AddAccountModal";
import type { PushToast } from "./Toasts";

import { fetchAccounts, upsertAccount, bulkUpsert } from "../data/coaRepository";
import {
  sortByCode, tabOf, TABS, type CoaAccount, type NormalBalance, type TabKey,
} from "../data/coa";
import { isSupabaseEnabled } from "../lib/supabase";

const PAGE_SIZE = 19;

/* ── Pagination helper: locate which page contains an account ─────── */
function pageOfCode(pages: DisplayRow[][], code: string): number | null {
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].some((r) => r.account.code === code)) return i + 1;
  }
  return null;
}

/* ── Pure filter / view builders (also used for optimistic page jumps) ── */
function makeMatcher(q: string, tab: TabKey, level: LevelFilter, status: StatusFilter) {
  return (a: CoaAccount): boolean => {
    if (status === "active" && !a.isActive) return false;
    if (status === "inactive" && a.isActive) return false;
    if (level === "headers" && !a.isHeader) return false;
    if (level === "details" && a.isHeader) return false;
    if (tab !== "all" && tabOf(a) !== tab) return false;
    if (q) {
      const hay = `${a.code} ${a.name} ${a.typeLabel} ${a.parentLabel ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
}

const statusMatches = (a: CoaAccount, status: StatusFilter) =>
  status === "all" || (status === "active" ? a.isActive : !a.isActive);

function buildView(opts: {
  accounts: CoaAccount[];
  headersList: CoaAccount[];
  groupedMode: boolean;
  matches: (a: CoaAccount) => boolean;
  status: StatusFilter;
  collapsed: Set<string>;
}): { grouped: boolean; pages: DisplayRow[][]; matchedCount: number } {
  const { accounts, headersList, groupedMode, matches, status, collapsed } = opts;

  if (!groupedMode) {
    const matched = accounts.filter(matches).sort(sortByCode);
    const rows: DisplayRow[] = matched.map((a) => ({ kind: a.isHeader ? "header" : "child", account: a }));
    const pages: DisplayRow[][] = [];
    for (let i = 0; i < rows.length; i += PAGE_SIZE) pages.push(rows.slice(i, i + PAGE_SIZE));
    return { grouped: false, pages, matchedCount: matched.length };
  }

  /* Grouped: paginate by whole header groups so children stay together */
  const pages: DisplayRow[][] = [];
  let cur: DisplayRow[] = [];
  let matchedCount = 0;

  for (const h of headersList) {
    const children = accounts
      .filter((a) => !a.isHeader && a.group === h.code && statusMatches(a, status))
      .sort(sortByCode);
    if (children.length === 0 && !statusMatches(h, status)) continue;

    const isOpen = !collapsed.has(h.code);
    const rows: DisplayRow[] = [
      { kind: "header", account: h, childCount: children.length },
      ...(isOpen ? children.map((a) => ({ kind: "child" as const, account: a })) : []),
    ];
    matchedCount += children.length + 1;

    if (cur.length > 0 && cur.length + rows.length > PAGE_SIZE) {
      pages.push(cur);
      cur = [];
    }
    cur.push(...rows);
  }
  if (cur.length) pages.push(cur);
  return { grouped: true, pages, matchedCount };
}

/* ── CSV helpers ───────────────────────────────────────────────────── */
const CSV_HEADER = "code,name,type_label,group_code,parent_code,parent_label,normal,is_header,can_post,is_active,is_locked,tx_count";

function toCsv(accounts: CoaAccount[]): string {
  const esc = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = accounts.map((a) =>
    [a.code, a.name, a.typeLabel, a.group, a.parentCode, a.parentLabel, a.normal, a.isHeader, a.canPost, a.isActive, a.isLocked, a.txCount]
      .map(esc).join(",")
  );
  return [CSV_HEADER, ...lines].join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const truthy = (v: string | undefined) => /^(true|1|ya|yes)$/i.test((v ?? "").trim());

/* ══════════════════════════ COA PAGE ═══════════════════════════════ */
export interface CoaPageProps {
  drill: { q: string; n: number };
  onQuerySync: (q: string) => void;
  onSource: (s: "supabase" | "demo") => void;
  pushToast: PushToast;
  /** Drill into Buku Besar for a specific account code */
  onOpenLedger: (code: string) => void;
}

export default function CoaPage({ drill, onQuerySync, onSource, pushToast, onOpenLedger }: CoaPageProps) {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState(drill.q);
  const [tab, setTab] = useState<TabKey>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [presetGroup, setPresetGroup] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Initial load (Supabase → demo fallback) ──────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, source: src } = await fetchAccounts();
        if (!alive) return;
        setAccounts(data);
        onSource(src);
        const preferred = data.find((a) => a.code === "4101");
        setSelectedId(preferred?.id ?? data[0]?.id ?? null);
        if (src === "demo") {
          pushToast("info", "Mode demo aktif", "Isi .env dengan kredensial Supabase untuk data live.");
        } else {
          pushToast("success", "Terhubung ke Supabase", "Tabel coa_accounts berhasil dimuat.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [pushToast, onSource]);

  /* ── External drill-down (from Topbar global search / Overview) ── */
  useEffect(() => {
    if (drill.n === 0) return;
    setQuery(drill.q);
    if (drill.q) {
      setTab("all");
      setLevel("all");
      setStatusFilter("all");
    }
  }, [drill.n]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Report query changes up (keep topbar in sync) ────────────── */
  useEffect(() => { onQuerySync(query); }, [query, onQuerySync]);

  /* ── Escape closes modal ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Reset page when filters change ───────────────────────────── */
  useEffect(() => { setPage(1); }, [query, tab, level, statusFilter]);

  /* ── Derived collections ──────────────────────────────────────── */
  const headersList = useMemo(
    () => accounts.filter((a) => a.isHeader).sort(sortByCode),
    [accounts]
  );

  const q = query.trim().toLowerCase();
  const groupedMode = tab === "all" && !q && level === "all";

  const statusOk = useCallback((a: CoaAccount) => statusMatches(a, statusFilter), [statusFilter]);
  const matchesFilter = useMemo(() => makeMatcher(q, tab, level, statusFilter), [q, tab, level, statusFilter]);

  const tabCounts = useMemo(() => {
    const base = accounts.filter(
      (a) =>
        statusOk(a) &&
        !(level === "headers" && !a.isHeader) &&
        !(level === "details" && a.isHeader) &&
        (!q || `${a.code} ${a.name} ${a.typeLabel}`.toLowerCase().includes(q))
    );
    const counts = {} as Record<TabKey, number>;
    for (const t of TABS) {
      counts[t.key] = t.key === "all" ? base.length : base.filter((a) => tabOf(a) === t.key).length;
    }
    return counts;
  }, [accounts, statusOk, level, q]);

  const view = useMemo(() => {
    if (loading) return { grouped: groupedMode, pages: [] as DisplayRow[][], matchedCount: 0 };
    return buildView({
      accounts, headersList, groupedMode, matches: matchesFilter, status: statusFilter, collapsed,
    });
  }, [loading, groupedMode, accounts, matchesFilter, headersList, statusFilter, collapsed]);

  const totalPages = Math.max(1, view.pages.length);
  const safePage = Math.min(page, totalPages);
  const pageRows = view.pages[safePage - 1] ?? [];
  const shownCount = pageRows.length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const expandedSet = useMemo(
    () => new Set(headersList.filter((h) => !collapsed.has(h.code)).map((h) => h.code)),
    [headersList, collapsed]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  /* ── Actions ──────────────────────────────────────────────────── */
  const handleToggleExpand = (code: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });

  const handleSelect = (a: CoaAccount) => setSelectedId(a.id);

  const handleSave = async (id: string, patch: Partial<CoaAccount>): Promise<boolean> => {
    const current = accounts.find((a) => a.id === id);
    if (!current) return false;
    if (patch.code && patch.code !== current.code && accounts.some((a) => a.code === patch.code)) {
      pushToast("error", "Kode akun duplikat", `Kode ${patch.code} sudah digunakan akun lain.`);
      return false;
    }
    const updated: CoaAccount = { ...current, ...patch, updatedAt: new Date().toISOString() };
    try {
      await upsertAccount(updated, accounts);
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)).sort(sortByCode));
      pushToast("success", "Perubahan disimpan", `${updated.code} — ${updated.name}`);
      return true;
    } catch (e) {
      pushToast("error", "Gagal menyimpan", e instanceof Error ? e.message : "Kesalahan tak dikenal.");
      return false;
    }
  };

  const handleToggleStatus = async (a: CoaAccount, next: boolean) => {
    const updated = { ...a, isActive: next, updatedAt: new Date().toISOString() };
    await upsertAccount(updated, accounts);
    setAccounts((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    pushToast(next ? "success" : "info", next ? "Akun diaktifkan" : "Akun dinonaktifkan", `${a.code} — ${a.name}`);
  };

  const handleAdd = async (p: AddPayload): Promise<{ ok: boolean; error?: string }> => {
    if (accounts.some((a) => a.code === p.code)) {
      return { ok: false, error: `Kode ${p.code} sudah digunakan akun lain.` };
    }
    const header = headersList.find((h) => h.code === p.group);
    const account: CoaAccount = {
      id: `a-${p.code}-${Date.now().toString(36)}`,
      code: p.code,
      name: p.name,
      typeLabel: p.typeLabel,
      group: p.group,
      parentCode: p.group,
      parentLabel: header ? `${header.code} - ${header.name}` : p.group,
      normal: p.normal,
      isHeader: false,
      canPost: p.canPost,
      isActive: true,
      isLocked: false,
      txCount: 0,
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertAccount(account, accounts);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan ke database." };
    }
    const merged = [...accounts, account].sort(sortByCode);
    setAccounts(merged);
    const nextCollapsed = new Set(collapsed);
    nextCollapsed.delete(p.group);
    setCollapsed(nextCollapsed);
    setSelectedId(account.id);

    /* Make sure the new account is visible, then jump straight to its page */
    const nextTab = tab !== "all" && tabOf(account) !== tab ? "all" : tab;
    const nextLevel = level === "headers" ? "all" : level;
    const nextStatus = statusFilter === "inactive" ? "active" : statusFilter;
    if (nextTab !== tab) setTab(nextTab);
    if (nextLevel !== level) setLevel(nextLevel);
    if (nextStatus !== statusFilter) setStatusFilter(nextStatus);

    const v = buildView({
      accounts: merged,
      headersList: merged.filter((a) => a.isHeader).sort(sortByCode),
      groupedMode: nextTab === "all" && !q && nextLevel === "all",
      matches: makeMatcher(q, nextTab, nextLevel, nextStatus),
      status: nextStatus,
      collapsed: nextCollapsed,
    });
    const targetPage = pageOfCode(v.pages, p.code);
    if (targetPage) setPage(targetPage);

    pushToast("success", `Akun ${p.code} ditambahkan`, p.name);
    return { ok: true };
  };

  const openAddModal = (group: string | null) => {
    setPresetGroup(group);
    setAddOpen(true);
  };

  const resetFilters = () => {
    setQuery("");
    setTab("all");
    setLevel("all");
    setStatusFilter("active");
    setPage(1);
  };

  const handleLedger = (a: CoaAccount) => {
    pushToast("info", `Buku Besar · ${a.code}`, `Membuka buku besar ${a.name}…`);
    onOpenLedger(a.code);
  };

  const handleExport = () => {
    const blob = new Blob([toCsv(accounts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentico-coa-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Ekspor COA berhasil", `${accounts.length} akun diekspor ke CSV.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      pushToast("error", "File kosong", "CSV tidak berisi baris data.");
      return;
    }
    const headerCols = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string) => headerCols.indexOf(name);
    if (idx("code") === -1 || idx("name") === -1) {
      pushToast("error", "Format tidak dikenal", "Kolom minimal: code, name. Gunakan template hasil Export.");
      return;
    }
    const existing = new Set(accounts.map((a) => a.code));
    const imported: CoaAccount[] = [];
    let skipped = 0;
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const get = (n: string) => (idx(n) >= 0 ? cols[idx(n)] ?? "" : "");
      const code = get("code").trim();
      const name = get("name").trim();
      if (!code || !name) { skipped++; continue; }
      if (existing.has(code)) { skipped++; continue; }
      existing.add(code);
      const isHeader = truthy(get("is_header"));
      const group = get("group_code").trim() || (isHeader ? code : "6200");
      const tx = parseInt(get("tx_count"), 10) || 0;
      const parentHeader = headersList.find((h) => h.code === group);
      imported.push({
        id: `imp-${code}-${Date.now().toString(36)}`,
        code,
        name,
        typeLabel: get("type_label") || (isHeader ? `Header ${group}` : "Diimpor"),
        group,
        parentCode: isHeader ? null : get("parent_code") || group,
        parentLabel: isHeader ? null : get("parent_label") || `${group} - ${parentHeader?.name ?? "Impor"}`,
        normal: (get("normal") === "Kredit" ? "Kredit" : "Debit") as NormalBalance,
        isHeader,
        canPost: isHeader ? false : !get("can_post") || truthy(get("can_post")),
        isActive: !get("is_active") || truthy(get("is_active")),
        isLocked: tx > 0 || truthy(get("is_locked")),
        txCount: tx,
        updatedAt: new Date().toISOString(),
      });
    }
    if (imported.length === 0) {
      pushToast("info", "Tidak ada akun baru", `${skipped} baris dilewati (duplikat/tidak valid).`);
      return;
    }
    try {
      const next = await bulkUpsert(imported, accounts);
      setAccounts(next);
      pushToast("success", "Import COA selesai", `${imported.length} akun ditambahkan · ${skipped} dilewati.`);
    } catch (err) {
      pushToast("error", "Import gagal", err instanceof Error ? err.message : "Kesalahan tak dikenal.");
    }
  };

  /* ══════════════════ RENDER ═════════════════════════════════════ */
  return (
    <div className="relative flex w-full flex-col gap-space-lg">
      {/* Glow accents */}
      <div className="pointer-events-none absolute -top-10 left-1/3 -z-10 h-96 w-96 rounded-full bg-primary-container/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-10 top-24 -z-10 h-80 w-80 rounded-full bg-secondary-container/10 blur-3xl" aria-hidden />

      {/* Breadcrumb + header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col justify-between gap-space-md md:flex-row md:items-center"
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-space-xs text-label-sm text-on-surface-variant">
            <span>Master Data</span>
            <ChevronRight size={13} className="text-outline" />
            <span className="font-semibold text-primary">Chart of Accounts (COA)</span>
            <span className="ml-2 rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              IFRS & PSAK Compliant
            </span>
          </div>
          <h1 className="mt-1 text-headline-xl tracking-tight text-on-surface">
            Chart of Accounts <span className="text-outline">(COA)</span>
          </h1>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            Fondasi struktur akun akuntansi Dentico terstandarisasi. Akun yang pernah memiliki
            transaksi berstatus proteksi (hanya dapat Nonaktifkan, bukan hapus).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-space-xs rounded-lg border border-surface-container bg-surface-container-lowest px-3.5 py-2 text-label-md text-on-surface shadow-soft transition-all hover:bg-surface-container-high active:scale-[0.98]"
          >
            <FileUp size={17} className="text-secondary" />
            <span>Import COA</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-space-xs rounded-lg border border-surface-container bg-surface-container-lowest px-3.5 py-2 text-label-md text-on-surface shadow-soft transition-all hover:bg-surface-container-high active:scale-[0.98]"
          >
            <FileDown size={17} className="text-outline" />
            <span>Export (CSV)</span>
          </button>
          <button
            onClick={() => openAddModal(null)}
            className="flex items-center gap-space-xs rounded-lg bg-primary-container px-4 py-2 text-label-md text-on-primary shadow-card transition-all hover:bg-secondary active:scale-[0.98]"
          >
            <Plus size={17} strokeWidth={2.4} />
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      </motion.div>

      {/* Metrics */}
      <MetricsRibbon accounts={accounts} />

      {/* Filters */}
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        tab={tab}
        onTabChange={setTab}
        tabCounts={tabCounts}
        level={level}
        onLevelChange={setLevel}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        onReset={resetFilters}
      />

      {/* Table + detail */}
      <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.22 }}
          className="xl:col-span-8"
        >
          <CoaTable
            rows={pageRows}
            loading={loading}
            grouped={view.grouped}
            expanded={expandedSet}
            onToggleExpand={handleToggleExpand}
            onExpandAll={() => setCollapsed(new Set())}
            onCollapseAll={() => setCollapsed(new Set(headersList.map((h) => h.code)))}
            selectedId={selectedId}
            onSelect={handleSelect}
            onAddChild={(h) => openAddModal(h.code)}
            shownCount={shownCount}
            matchedCount={view.matchedCount}
            totalCount={accounts.length}
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            onResetFilters={resetFilters}
          />
        </motion.div>
        <div className="xl:col-span-4">
          <DetailPanel
            account={selectedAccount}
            headers={headersList}
            onSave={handleSave}
            onToggleStatus={handleToggleStatus}
            onOpenLedger={handleLedger}
          />
        </div>
      </div>

      {/* Footnote */}
      <div className="flex items-center justify-between border-t border-surface-container pt-space-md text-[11px] text-body-sm text-outline">
        <span>Dentico Finance Core v2.4 · Chart of Accounts · IFRS & PSAK</span>
        <span>{isSupabaseEnabled ? "Sumber data: Supabase (coa_accounts)" : "Sumber data: dummy dataset lokal"}</span>
      </div>

      {/* Hidden CSV input + modal */}
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
      <AddAccountModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        headers={headersList}
        accounts={accounts}
        presetGroup={presetGroup}
        onAdd={handleAdd}
      />
    </div>
  );
}
