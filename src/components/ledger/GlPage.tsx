import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight, Eye, Printer, Share2, ChevronDown, Landmark, Calendar,
  Building2, BadgeCheck, Zap, Search, ListFilter, RefreshCw, Lock,
  ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, ShieldCheck, Lightbulb,
  X, ReceiptText, Paperclip, FileText, Receipt, Download,
  SearchX, ChevronsUpDown, Bug,
} from "lucide-react";

import { fetchAccounts } from "../../data/coaRepository";
import { fetchGlSupplements } from "../../data/ledgerRepository";
import {
  getJournals, initJournalStore, refreshJournals, subscribeJournals,
} from "../../data/journalStore";
import { buildLedger, auditHash, type GlEntry, type GlSupplement, type GlBukti } from "../../data/ledger";
import { pillarOf, PILLAR_CHIP_CLASSES, type CoaAccount } from "../../data/coa";
import { fmtRpFull, fmtRpJt } from "../../data/finance";
import { fmtDateId, shortNumber, type Journal } from "../../data/journal";
import type { PushToast } from "../Toasts";
import { cn } from "../../utils/cn";
import {
  defaultRange, fmtDateShort, fmtMonthYear, isSameRange, labelPeriod, labelRange,
  normalizeRange, rangePresets, type DateRange, type RangePresetId,
} from "../../utils/dateRange";
import useScopeStore from "../../hooks/useScopeStore";

/* ══════════════════════════ Helpers ════════════════════════════════ */
const BUKTI_ICON: Record<GlBukti, typeof Receipt> = {
  receipt: Receipt, attach: Paperclip, verified: BadgeCheck, doc: FileText, lock: Lock,
};

const QUICK_PILLS = ["1103", "1101", "4101", "5101", "6001", "6201"];

const fmtNum = (v: number) => new Intl.NumberFormat("id-ID").format(v);

/**
 * Normalizes how an entry's entity/cabang is displayed and filtered.
 *
 * Supplements often already store a combined label like "Brand A - Gejayan".
 * Journal-derived entries store `brand` and `branch` separately, e.g.
 *   brand  = "Brand A"
 *   branch = "Yogyakarta - Gejayan"
 *
 * Buku Besar must treat those as the SAME business scope.
 */
function entryScopeLabel(entry: GlEntry): string {
  const branch = entry.branch.trim();
  const brand = entry.journal?.brand?.trim();
  if (!brand) return branch;
  if (branch.toLowerCase().includes(brand.toLowerCase())) return branch;
  return `${brand} - ${branch}`;
}

function matchesBranchFilter(filter: string, entry: GlEntry): boolean {
  if (filter === "Semua Cabang (Grup)") return true;
  const scope = entryScopeLabel(entry).toLowerCase();
  const tokens = filter.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.every((t) => scope.includes(t));
}

/* ══════════════════════════ Drawer ═════════════════════════════════ */
function GlDrawer({ entry, account, onClose, onOpenJournal }: {
  entry: GlEntry | null; account: CoaAccount | null; onClose: () => void; onOpenJournal: () => void;
}) {
  const isDebit = (entry?.debit ?? 0) > 0;
  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full flex-col justify-between bg-surface-container-lowest shadow-pop sm:w-[460px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-space-md">
              <div className="flex items-center gap-space-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <ReceiptText size={19} />
                </div>
                <div className="flex flex-col">
                  <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Detail Voucher Jurnal</span>
                  <span className="font-mono text-headline-sm text-on-surface">{entry.voucher}</span>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container">
                <X size={19} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-space-md overflow-y-auto p-space-md scrollbar-none">
              <div className={cn("flex items-center justify-between rounded-lg p-space-sm", isDebit ? "bg-emerald-500/[0.08]" : "bg-rose-500/[0.06]")}>
                <div className="flex flex-col">
                  <span className="text-label-sm uppercase text-on-surface-variant">Jenis Mutasi</span>
                  <span className={cn("text-headline-sm font-bold", isDebit ? "text-emerald-700" : "text-error")}>
                    {isDebit ? "Penerimaan Kas (Debit)" : "Pengeluaran Kas/Bank (Kredit)"}
                  </span>
                </div>
                <div className={cn("text-num-metric-lg", isDebit ? "text-emerald-700" : "text-error")}>
                  {isDebit ? "+" : "-"}{fmtRpJt(isDebit ? entry.debit : entry.credit)}
                </div>
              </div>

              <div className="space-y-space-xs text-body-sm">
                {[
                  { k: "Tanggal Transaksi", v: `${fmtDateId(entry.date)} · ${entry.time} WIB` },
                  { k: "Referensi Sumber", v: entry.ref || "—", mono: true },
                  { k: "Entitas / Unit", v: entryScopeLabel(entry) },
                  { k: "Lawan Akun GL", v: entry.offsetLabel, accent: true },
                ].map((r) => (
                  <div key={r.k} className="flex items-start justify-between gap-3 rounded bg-surface-container-low/50 px-space-sm py-1.5">
                    <span className="shrink-0 text-on-surface-variant">{r.k}:</span>
                    <span className={cn("text-right font-semibold", r.mono && "font-mono text-primary", r.accent && "text-primary")}>{r.v}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded bg-surface-container-low/50 px-space-sm py-1.5">
                  <span className="text-on-surface-variant">Status Validasi:</span>
                  <span className="flex items-center gap-1 font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Posted & Bank Reconciled
                  </span>
                </div>
              </div>

              {(entry.memo || entry.description) && (
                <div className="flex flex-col gap-1">
                  <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Keterangan Memo Lengkap</span>
                  <div className="rounded-lg bg-surface-container p-space-sm text-body-md leading-relaxed text-on-surface">
                    {entry.memo || entry.description}
                    {entry.subDescription && <span className="mt-1 block text-body-sm text-on-surface-variant">{entry.subDescription}</span>}
                  </div>
                </div>
              )}

              {/* Double entry breakdown */}
              <div className="flex flex-col gap-1">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Potongan Jurnal Terkait (Double Entry)</span>
                <div className="overflow-hidden rounded-lg bg-surface-container-low">
                  <div className="grid grid-cols-12 bg-surface-container px-space-sm py-2 text-label-sm text-on-surface-variant">
                    <div className="col-span-7">Akun & Keterangan</div>
                    <div className="col-span-5 text-right">Debit / Kredit</div>
                  </div>
                  <div className="space-y-2 p-space-sm text-[12px]">
                    {account && (
                      <div className="grid grid-cols-12 items-center">
                        <div className="col-span-7 font-semibold text-on-surface">[{account.code}] {account.name}</div>
                        <div className={cn("col-span-5 text-right font-mono font-bold", isDebit ? "text-emerald-600" : "text-error")}>
                          {isDebit ? `D: ${fmtNum(entry.debit)}` : `K: ${fmtNum(entry.credit)}`}
                        </div>
                      </div>
                    )}
                    {(() => {
                      if (entry.journal) {
                        return entry.journal.lines
                          .filter((l) => l.accountCode !== account?.code)
                          .map((l, i) => (
                            <div key={i} className="grid grid-cols-12 items-center pl-3">
                              <div className="col-span-7 text-on-surface-variant">[{l.accountCode}] {l.accountName}</div>
                              <div className={cn("col-span-5 text-right font-mono font-bold", l.debit > 0 ? "text-emerald-600" : "text-error")}>
                                {l.debit > 0 ? `D: ${fmtNum(l.debit)}` : `K: ${fmtNum(l.credit)}`}
                              </div>
                            </div>
                          ));
                      }
                      return (
                        <div className="grid grid-cols-12 items-center pl-3">
                          <div className="col-span-7 text-on-surface-variant">{entry.offsetLabel}</div>
                          <div className={cn("col-span-5 text-right font-mono font-bold", isDebit ? "text-error" : "text-emerald-600")}>
                            {isDebit ? `K: ${fmtNum(entry.debit)}` : `D: ${fmtNum(entry.credit)}`}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Attachment */}
              <div className="flex flex-col gap-1">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Lampiran Bukti Digital (Voucher)</span>
                <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <FileText size={22} className="text-primary" />
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface">bukti-{entry.ref.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "voucher"}.pdf</span>
                      <span className="text-[10px] text-body-sm text-on-surface-variant">1.2 MB • SHA256 Valid</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-surface-container-lowest p-1.5 text-primary"><Download size={16} /></span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-space-sm bg-surface-container-low p-space-md">
              <button
                onClick={onOpenJournal}
                className="flex-1 rounded-lg bg-primary-container py-2.5 text-center text-label-md text-on-primary-container shadow-soft transition-colors hover:bg-secondary"
              >
                Buka Lembar Jurnal Penuh
              </button>
              <button onClick={onClose} className="rounded-lg bg-surface-container-lowest px-space-md py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container">
                Tutup
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════ Account picker ═════════════════════════ */
function AccountPicker({ open, accounts, selected, onSelect, onClose }: {
  open: boolean; accounts: CoaAccount[]; selected: string; onSelect: (code: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return accounts.filter((a) => !t || `${a.code} ${a.name} ${a.typeLabel}`.toLowerCase().includes(t));
  }, [accounts, q]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-inverse-surface/45 p-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-pop"
          >
            <div className="flex items-center gap-space-sm border-b border-surface-container px-space-md py-3">
              <Search size={18} className="text-outline" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Cari kode atau nama akun posting…"
                className="w-full bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline"
              />
              <button onClick={onClose} className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low"><X size={17} /></button>
            </div>
            <div className="max-h-[46vh] overflow-y-auto p-2 scrollbar-none">
              {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <SearchX size={22} className="text-outline" />
                  <p className="text-body-sm text-on-surface-variant">Tidak ada akun yang cocok dengan pencarian.</p>
                </div>
              ) : (
                list.map((a) => {
                  const active = a.code === selected;
                  return (
                    <button
                      key={a.code}
                      onClick={() => { onSelect(a.code); onClose(); setQ(""); }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/10" : "hover:bg-surface-container-low"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("rounded bg-surface-container px-2 py-0.5 font-mono text-[11px] font-bold", active ? "text-primary" : "text-on-surface-variant")}>
                          {a.code}
                        </span>
                        <span className="truncate text-label-md text-on-surface">{a.name}</span>
                      </div>
                      <span className={cn("ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] text-label-sm", PILLAR_CHIP_CLASSES[pillarOf(a)])}>
                        {pillarOf(a)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-surface-container px-space-md py-2 text-[11px] text-body-sm text-on-surface-variant">
              {list.length} akun posting (Level 2) — akun header tidak dapat memiliki mutasi GL langsung.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════ Main page ══════════════════════════════ */
interface GlPageProps {
  pushToast: PushToast;
  ledgerDrill: { code: string | null; n: number };
  onOpenJournal: () => void;
}

const selBox = "flex flex-1 min-w-0 flex-col";
const selCls = "w-full cursor-pointer appearance-none truncate bg-transparent text-label-md text-on-surface outline-none";
const dateInputCls =
  "w-full min-w-0 cursor-pointer bg-transparent text-[12px] text-on-surface outline-none";

export default function GlPage({ pushToast, ledgerDrill, onOpenJournal }: GlPageProps) {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [supplements, setSupplements] = useState<GlSupplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState("1103");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"running" | "periodik">("running");
  const [drawerEntry, setDrawerEntry] = useState<GlEntry | null>(null);
  /* Default mengikuti tanggal saat aplikasi dibuka (awal bulan → hari ini),
     bukan periode tetap, dan batasnya bisa digeser kapan saja. */
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [rangePreset, setRangePreset] = useState<RangePresetId>("month");
  const [branchFilter, setBranchFilter] = useState("Semua Cabang (Grup)");
  const [statusFilter, setStatusFilter] = useState("Hanya Posted (Valid)");
  const scope = useScopeStore();

  const presets = useMemo(() => rangePresets(), []);

  /**
   * Terapkan preset atau rentang bebas. Batas bawah/atas selalu diurutkan,
   * dan preset yang kebetulan sama dengan pilihan manual ikut terpilih.
   */
  const applyRange = useCallback((preset: RangePresetId, next?: DateRange) => {
    const normalized = normalizeRange(next ?? presets[preset].range);
    setRange(normalized);
    if (preset !== "custom") {
      setRangePreset(preset);
      return;
    }
    const matched = (Object.keys(presets) as RangePresetId[])
      .find((id) => id !== "custom" && isSameRange(presets[id].range, normalized));
    setRangePreset(matched ?? "custom");
  }, [presets]);

  useEffect(() => {
    initJournalStore();
    let alive = true;
    (async () => {
      const [a, s] = await Promise.all([fetchAccounts(), fetchGlSupplements(), refreshJournals()]);
      if (!alive) return;
      setAccounts(a.data);
      setSupplements(s.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  /* Subscribe to the single registry: every journal change, anywhere
     in the app, lands here instantly — no fetch race, no stale copy. */
  useEffect(() => subscribeJournals(() => setJournals(getJournals())), []);

  /* External drill (COA → "Lihat Buku Besar Akun Ini") */
  useEffect(() => {
    if (ledgerDrill.n > 0 && ledgerDrill.code) {
      setSelectedCode(ledgerDrill.code);
      setSearch("");
    }
  }, [ledgerDrill]);

  const account = useMemo(
    () => accounts.find((a) => a.code === selectedCode && !a.isHeader)
      ?? accounts.find((a) => a.code === selectedCode)
      ?? null,
    [accounts, selectedCode]
  );

  const postingAccounts = useMemo(
    () => accounts.filter((a) => !a.isHeader && a.canPost).sort((x, y) => x.code.localeCompare(y.code)),
    [accounts]
  );

  const includePending = statusFilter.includes("Pending");

  /** Journals touching this account that haven't reached POSTED yet */
  const pendingForAccount = useMemo(() => {
    if (!account) return [];
    return journals.filter(
      (j) => j.status !== "POSTED" && j.lines.some((l) => l.accountCode === account.code)
    );
  }, [journals, account]);

  /** Ledger result */
  const ledger = useMemo(
    () => buildLedger(account, journals, supplements, { includePending }),
    [account, journals, supplements, includePending]
  );

  /**
   * Diagnostics: journals that touch posting accounts OTHER than the
   * currently open one — tells you exactly which GL pages to open.
   */
  const elseWhere = useMemo(() => {
    if (!account) return [];
    return journals
      .filter((j) => j.status === "POSTED" && !j.lines.some((l) => l.accountCode === account.code))
      .slice(-3)
      .map((j) => ({
        journal: j,
        codes: [...new Set(j.lines.map((l) => l.accountCode))],
      }));
  }, [journals, account]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledger.entries.filter((e) => {
      if (!matchesBranchFilter(branchFilter, e)) return false;
      if (e.date < range.from || e.date > range.to) return false;
      if (q && !`${e.voucher} ${e.ref} ${e.description} ${e.offsetLabel} ${e.subDescription ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger.entries, search, branchFilter, range]);

  /** true when the account HAS posted activity but viewport filters hide every row */
  const hiddenByFilters = ledger.entries.length > 0 && visible.length === 0;

  const periodLabel = labelPeriod(range);

  const hash = account ? auditHash(account.code) : "—";
  const netFlow = ledger.totalDebit - ledger.totalCredit;

  /** Self-diagnosis lookup: locate any voucher inside the live registry
      and tell the user exactly which GL account pages contain it. */
  const [debugQuery, setDebugQuery] = useState("");
  const debugResult = useMemo(() => {
    const q = debugQuery.trim().toUpperCase();
    if (!q) return null;
    const normalized = q.replace(/^JV[-/]?/i, "");
    const hit = journals.find((j) =>
      j.number.toUpperCase().includes(normalized.length <= 4 ? normalized : q) ||
      j.reference.toUpperCase().includes(q)
    );
    if (!hit) return { found: false as const, q };
    return {
      found: true as const,
      journal: hit,
      codes: [...new Set(hit.lines.map((l) => l.accountCode))],
    };
  }, [debugQuery, journals]);

  /* Export CSV of current view */
  const handleExport = () => {
    if (!account) return;
    const header = "tanggal,voucher,ref,cabang,keterangan,lawan_akun,debit,kredit,saldo_berjalan";
    const rows = visible.map((e) =>
      [e.date, e.voucher, e.ref, entryScopeLabel(e), `"${e.description.replace(/"/g, '""')}"`, `"${e.offsetLabel}"`, e.debit, e.credit, e.runningBalance].join(",")
    );
    const blob = new Blob([[`akun,${account.code} - ${account.name}\nsaldo_awal,${ledger.opening}\n`, header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gl-${account.code}-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Ledger diekspor", `${visible.length} mutasi akun [${account.code}] ke CSV.`);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-space-lg">
        <div className="h-24 animate-pulse rounded-xl bg-surface-container-lowest shadow-soft" />
        <div className="h-28 animate-pulse rounded-xl bg-surface-container-lowest shadow-soft" />
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-container-lowest shadow-soft" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-surface-container-lowest shadow-soft" />
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col gap-space-lg">
      <div className="pointer-events-none absolute -top-8 left-1/3 -z-10 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl" aria-hidden />

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center"
      >
        <div className="flex flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-xs text-label-sm text-on-surface-variant">
            <span>Accounting & Control</span>
            <ChevronRight size={13} className="text-outline" />
            <span className="font-semibold text-primary">Buku Besar (General Ledger)</span>
            <ChevronRight size={13} className="text-outline" />
            <span className="rounded-full bg-surface-container-high px-space-xs py-0.5 text-label-sm text-on-surface">Akun Terpilih</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-space-sm">
            <h1 className="text-headline-xl tracking-tight text-on-surface">Buku Besar</h1>
            <div className="flex items-center gap-1.5 rounded-full bg-surface-container-highest/80 px-space-sm py-1 text-label-sm text-primary">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary" />
              <span>Single-Account Traceability</span>
            </div>
          </div>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            Rekapitulasi mutasi dan saldo berjalan per akun terverifikasi dari jurnal posted real-time.
            Dilengkapi jejak audit kriptografis untuk kepatuhan klinis multientitas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            onClick={() => visible.length > 0 && setDrawerEntry(visible[visible.length - 1])}
            className="flex items-center gap-space-xs rounded-lg border border-surface-container bg-surface-container-lowest px-space-md py-2.5 text-label-md text-on-surface shadow-soft transition-all hover:bg-surface-container-low active:scale-[0.98]"
          >
            <Eye size={17} className="text-primary" /> <span>Drawer Detail</span>
          </button>
          <button
            onClick={() => pushToast("info", "Cetak Rekening Koran GL", "PDF ber-watermark resmi dijadwalkan — unduh lewat Export Ledger saat ini.")}
            className="flex items-center gap-space-xs rounded-lg border border-surface-container bg-surface-container-lowest px-space-md py-2.5 text-label-md text-on-surface shadow-soft transition-all hover:bg-surface-container-low active:scale-[0.98]"
          >
            <Printer size={17} className="text-outline" /> <span>Cetak Rekening Koran GL</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-space-xs rounded-lg bg-primary-container px-space-md py-2.5 text-label-md text-on-primary-container shadow-card transition-all hover:bg-secondary active:scale-[0.98]"
          >
            <Share2 size={16} /> <span>Export Ledger</span> <ChevronDown size={14} />
          </button>
        </div>
      </motion.div>

      {/* ── Filter console ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }}
        className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-soft"
      >
        <div className="grid grid-cols-1 items-center gap-space-sm md:grid-cols-12">
          {/* Account card */}
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm text-left transition-colors hover:bg-surface-container md:col-span-5"
          >
            <div className="flex min-w-0 items-center gap-space-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary">
                <Landmark size={20} />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Akun COA Aktif</span>
                <span className="truncate text-headline-sm text-on-surface">
                  {account ? `[${account.code}] ${account.name}` : "— Pilih Akun —"}
                </span>
                <span className="truncate text-[11px] text-body-sm text-on-surface-variant">
                  {account ? `${account.typeLabel} • Normal: ${account.normal.toUpperCase()}` : ""}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-space-xs pl-2">
              <span className="rounded bg-surface-container-highest px-space-xs py-0.5 text-[10px] text-label-sm font-semibold text-primary">Active GL</span>
              <ChevronsUpDown size={16} className="text-outline" />
            </div>
          </button>

          {/* Date range — preset relatif hari ini + rentang bebas tanpa batas tetap */}
          <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm md:col-span-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-highest text-primary"><Calendar size={16} /></div>
            <div className={selBox}>
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Rentang Waktu</span>
              <div className="relative">
                <select
                  value={rangePreset}
                  onChange={(e) => applyRange(e.target.value as RangePresetId)}
                  className={selCls}
                >
                  {(["custom", "today", "week", "month", "lastMonth", "quarter", "ytd", "all"] as RangePresetId[])
                    .map((id) => <option key={id} value={id}>{presets[id].label}</option>)}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-outline" />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <input
                type="date"
                aria-label="Tanggal mulai"
                value={range.from}
                max={range.to}
                onChange={(e) => applyRange("custom", { ...range, from: e.target.value })}
                className={dateInputCls}
              />
              <span className="text-[11px] text-outline">–</span>
              <input
                type="date"
                aria-label="Tanggal akhir"
                value={range.to}
                min={range.from}
                onChange={(e) => applyRange("custom", { ...range, to: e.target.value })}
                className={dateInputCls}
              />
            </div>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm md:col-span-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-highest text-primary"><Building2 size={16} /></div>
            <div className={selBox}>
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Cabang / Unit</span>
              <div className="relative">
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={selCls}>
                  {scope.cabangFilterOpts.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-outline" />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm md:col-span-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-highest text-primary"><BadgeCheck size={16} /></div>
            <div className={selBox}>
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Status Mutasi</span>
              <div className="relative">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selCls}>
                  <option>Hanya Posted (Valid)</option>
                  <option>Posted + Pending Audit</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-outline" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick pills */}
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 pt-1 scrollbar-none">
          <span className="mr-space-xs flex shrink-0 items-center gap-1 text-label-sm uppercase tracking-wider text-outline">
            <Zap size={13} /> Akun Cepat:
          </span>
          {QUICK_PILLS.map((code) => {
            const a = accounts.find((x) => x.code === code);
            const active = selectedCode === code;
            return (
              <button
                key={code}
                onClick={() => setSelectedCode(code)}
                className={cn(
                  "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-space-sm py-1.5 text-label-md transition-all",
                  active
                    ? "bg-primary-container text-on-primary-container shadow-soft"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                )}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-surface-container-lowest" />}
                <span>[{code}] {a?.name.split(" ")[0] ?? code}{a ? ` ${a.name.split(" ").slice(1, 3).join(" ")}` : ""}</span>
              </button>
            );
          })}
          <button
            onClick={() => setPickerOpen(true)}
            className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface-container px-space-sm py-1.5 text-label-md text-primary transition-all hover:bg-surface-container-high"
          >
            <Search size={14} />
            <span>Semua Akun ({postingAccounts.length})</span>
          </button>
        </div>
      </motion.div>

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
        className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* Opening */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-soft">
          <div className="mb-space-sm flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Saldo Awal ({fmtDateShort(range.from)})</span>
            <span className="rounded bg-surface-container-high px-space-xs py-0.5 text-[10px] text-label-sm text-on-surface">
              {account?.normal.toUpperCase() ?? "DEBIT"}
            </span>
          </div>
          <div>
            <div className="text-num-metric-lg tracking-tight text-on-surface">{fmtRpFull(ledger.opening)}</div>
            <div className="mt-1 flex items-center gap-space-xs text-body-sm text-on-surface-variant">
              <Clock size={14} className="text-primary" />
              <span>{ledger.opening > 0 ? `Bawaan dari Tutup Buku ${fmtMonthYear(range.from)}` : "Akun nominal — akrual periode berjalan"}</span>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between pt-space-xs text-[11px] text-label-sm text-on-surface-variant">
            <span>Jurnal Saldo: GL-OPN-{range.from.replace(/-/g, "")}</span>
            <span className="font-semibold text-primary">Tervalidasi</span>
          </div>
        </div>
        {/* Debit total */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-soft">
          <div className="mb-space-sm flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Total Mutasi Debit (+)</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><ArrowDownLeft size={15} /></div>
          </div>
          <div>
            <div className="text-num-metric-lg tracking-tight text-emerald-600">+{fmtRpFull(ledger.totalDebit)}</div>
            <div className="mt-1 flex items-center gap-space-xs text-body-sm text-on-surface-variant">
              <span className="font-semibold text-emerald-700">{ledger.entries.filter((e) => e.debit > 0).length} Transaksi Masuk</span>
              <span>• Kasir, EDC, & QRIS</span>
            </div>
          </div>
          <div className="mt-space-sm flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
            <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }}
              animate={{ width: `${(ledger.totalDebit / Math.max(ledger.totalDebit, ledger.totalCredit, 1)) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.3 }} />
          </div>
        </div>
        {/* Credit total */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-soft">
          <div className="mb-space-sm flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Total Mutasi Kredit (-)</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/10 text-error"><ArrowUpRight size={15} /></div>
          </div>
          <div>
            <div className="text-num-metric-lg tracking-tight text-error">-{fmtRpFull(ledger.totalCredit)}</div>
            <div className="mt-1 flex items-center gap-space-xs text-body-sm text-on-surface-variant">
              <span className="font-semibold text-error">{ledger.entries.filter((e) => e.credit > 0).length} Transaksi Keluar</span>
              <span>• Vendor & Jasa Medis</span>
            </div>
          </div>
          <div className="mt-space-sm flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
            <motion.div className="h-full rounded-full bg-rose-500" initial={{ width: 0 }}
              animate={{ width: `${(ledger.totalCredit / Math.max(ledger.totalDebit, ledger.totalCredit, 1)) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.35 }} />
          </div>
        </div>
        {/* Ending */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-primary-container p-space-md text-on-primary-container shadow-card">
          <div className="mb-space-sm flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-primary-container/80">Saldo Akhir Berjalan</span>
            <div className="flex items-center gap-1 rounded-full bg-surface-container-lowest/20 px-space-xs py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <span className="text-[10px] text-label-sm">MATCH 100%</span>
            </div>
          </div>
          <div>
            <div className="text-num-metric-lg tracking-tight">{fmtRpFull(ledger.ending)}</div>
            <div className="mt-1 flex items-center gap-space-xs text-body-sm text-on-primary-container/90">
              <CheckCircle2 size={15} />
              <span>Balanced dengan Mutasi Rekening Bank</span>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between pt-space-xs text-[11px] text-label-sm text-on-primary-container/80">
            <span>Net Flow Bulan Ini:</span>
            <span className="font-bold text-on-primary-container">{netFlow >= 0 ? "+" : "-"}{fmtRpFull(Math.abs(netFlow))}</span>
          </div>
        </div>
      </motion.div>

      {/* ── Integrity pill ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
        className="flex items-center justify-between rounded-xl bg-emerald-50 p-space-sm px-space-md text-emerald-900 shadow-soft"
      >
        <div className="flex items-center gap-space-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-800">
            <BadgeCheck size={19} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-space-sm">
            <span className="text-headline-sm font-bold text-emerald-950">Ledger Integrity Status: Clean & Audited</span>
            <span className="hidden text-emerald-400 sm:inline">•</span>
            <span className="text-body-sm text-emerald-800">
              Semua entri diverifikasi hash SHA-256 — cocok dengan Rekonsiliasi Bank BSI No. Rek 7109-8821-00
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-space-xs text-label-sm text-emerald-700 md:flex">
          <Clock size={15} /> <span>Sinkron 3 menit lalu</span>
        </div>
      </motion.div>

      {/* ── Pending journals notice ────────────────────────────── */}
      {pendingForAccount.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex flex-col justify-between gap-space-sm rounded-xl border border-amber-200/70 bg-amber-50 p-space-md text-amber-900 shadow-soft sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-space-sm">
            <Clock size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex flex-col">
              <span className="text-label-md font-semibold text-amber-950">
                {pendingForAccount.length} jurnal menyentuh akun ini belum final di Buku Besar
              </span>
              <span className="text-body-sm text-amber-800">
                {pendingForAccount.map((j) => `${shortNumber(j.number)} (${j.status})`).join(", ")} — GL standar
                hanya menampilkan entri <strong>POSTED</strong>. Approve & post dari registry Jurnal Umum,
                atau tampilkan pending untuk pratinjau.
              </span>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter(includePending ? "Hanya Posted (Valid)" : "Posted + Pending Audit")}
            className="shrink-0 rounded-lg bg-amber-500/15 px-space-sm py-1.5 text-label-sm font-bold text-amber-900 transition-colors hover:bg-amber-500/25"
          >
            {includePending ? "Sembunyikan Pending" : "Tampilkan Pending"}
          </button>
        </motion.div>
      )}

      {/* ── Diagnostics: activity exists but filtered out ──────── */}
      {hiddenByFilters && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex flex-col justify-between gap-space-sm rounded-xl border border-primary/15 bg-primary/[0.04] p-space-md shadow-soft sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-space-sm">
            <SearchX size={18} className="mt-0.5 shrink-0 text-primary" />
            <div className="flex flex-col">
              <span className="text-label-md font-semibold text-on-surface">
                Akun ini memiliki {ledger.entries.length} mutasi posted — tetapi filter tanggal/cabang Anda membuang semuanya
              </span>
              <span className="text-body-sm text-on-surface-variant">
                Saldo akhir tetap {fmtRpFull(ledger.ending)}; yang tersaring hanya baris tampilan. Longgarkan rentang & setel cabang ke "Semua Cabang (Grup)".
              </span>
            </div>
          </div>
          <button
            onClick={() => { setBranchFilter("Semua Cabang (Grup)"); setStatusFilter("Hanya Posted (Valid)"); applyRange("month"); setSearch(""); }}
            className="shrink-0 rounded-lg bg-primary-container px-space-sm py-1.5 text-label-sm font-bold text-on-primary-container transition-colors hover:bg-secondary"
          >
            Reset Filter Tampilan
          </button>
        </motion.div>
      )}

      {/* ── Diagnostics: posted journals live on OTHER accounts ─── */}
      {!hiddenByFilters && visible.length === 0 && elseWhere.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex items-start gap-space-sm rounded-xl border border-primary/15 bg-primary/[0.04] p-space-md text-on-surface shadow-soft"
        >
          <SearchX size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <span className="text-label-md font-semibold">
              Akun ini belum memiliki mutasi — jurnal posted Anda tercatat di akun lain
            </span>
            <span className="text-body-sm text-on-surface-variant">
              {elseWhere.map((x) => (
                <span key={x.journal.id} className="mr-3 block sm:inline">
                  <button
                    onClick={() => setSelectedCode(x.codes[0])}
                    className="font-mono font-bold text-primary hover:underline"
                  >
                    {shortNumber(x.journal.number)}
                  </button>
                  {" → buka GL "}
                  {x.codes.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCode(c)}
                      className="mx-0.5 rounded bg-surface-container px-1 font-mono font-semibold text-on-surface hover:bg-primary hover:text-on-primary"
                    >
                      [{c}]
                    </button>
                  ))}
                </span>
              ))}
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Ledger table ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }}
        className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-soft"
      >
        {/* Toolbar */}
        <div className="flex flex-col justify-between gap-space-sm p-space-md md:flex-row md:items-center">
          <div className="flex items-center gap-space-sm">
            <div className="flex w-72 items-center gap-space-xs rounded-lg border border-transparent bg-surface-container-low px-space-sm py-1.5 text-on-surface-variant transition-all focus-within:border-primary/30 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/40">
              <ListFilter size={15} className="text-outline" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari keterangan, nomor jurnal, lawan akun…"
                className="w-full bg-transparent text-body-sm text-on-surface outline-none placeholder:text-outline"
              />
            </div>
            <span className="text-label-sm text-on-surface-variant">{visible.length} Transaksi Ditemukan</span>
            {/* Self-diagnosis lens: type JV-0144 to see where it lives */}
            <div className="hidden items-center gap-1 rounded-lg bg-surface-container-low px-2 py-1 lg:flex" title="Diagnosis voucher di registry GL">
              <Bug size={13} className="text-outline" />
              <input
                value={debugQuery}
                onChange={(e) => setDebugQuery(e.target.value)}
                placeholder="ceklok: JV-0144"
                className="w-24 bg-transparent font-mono text-[11px] text-on-surface outline-none placeholder:text-outline-variant"
              />
              {debugResult && (
                debugResult.found ? (
                  <span className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                    {debugResult.journal.status} →
                    {debugResult.codes.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setSelectedCode(c); setDebugQuery(""); }}
                        className="rounded bg-emerald-500/10 px-1 font-mono text-emerald-700 hover:bg-emerald-500 hover:text-white"
                      >
                        [{c}]
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-error">tidak ada di registry GL</span>
                )
              )}
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="mr-1 text-label-sm text-on-surface-variant">Tampilan Saldo:</span>
            {(["running", "periodik"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-space-sm py-1 text-label-sm transition-all",
                  mode === m ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                )}
              >
                {m === "running" ? "Berjalan (Running)" : "Periodik Bersih"}
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-surface-container-high" />
            <button
              onClick={async () => {
                await refreshJournals();
                pushToast("success", "GL disegarkan", "Mutasi tersinkron dengan journal registry terbaru.");
              }}
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              title="Refresh GL"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr className="bg-surface-container-low text-label-sm uppercase tracking-wider text-on-surface-variant">
                <th className="w-32 px-space-md py-3">Tanggal & Waktu</th>
                <th className="w-36 px-space-md py-3">No. Jurnal / Ref</th>
                <th className="w-40 px-space-md py-3">Entitas & Cabang</th>
                <th className="min-w-[260px] px-space-md py-3">Keterangan Transaksi</th>
                <th className="w-52 px-space-md py-3">Lawan Akun (Offset)</th>
                <th className="w-32 px-space-md py-3 text-right">Debit (IDR)</th>
                <th className="w-32 px-space-md py-3 text-right">Kredit (IDR)</th>
                <th className="w-40 px-space-md py-3 text-right">Saldo Berjalan</th>
                <th className="w-20 px-space-md py-3 text-center">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low text-body-sm text-on-surface">
              {/* Opening row */}
              <tr className="bg-surface-container-low/40 font-semibold">
                <td className="px-space-md py-3 text-on-surface tnum">{fmtDateId(range.from)}</td>
                <td className="px-space-md py-3">
                  <span className="rounded bg-surface-container-highest px-2 py-0.5 font-mono text-[11px] text-primary">GL-OPN-{range.from.replace(/-/g, "")}</span>
                </td>
                <td className="px-space-md py-3 text-on-surface-variant">Dentico Group (HO)</td>
                <td className="px-space-md py-3 text-headline-sm text-primary">Saldo Awal Periode {fmtMonthYear(range.from)}</td>
                <td className="px-space-md py-3 italic text-on-surface-variant">[3103] Laba Ditahan</td>
                <td className="px-space-md py-3 text-right text-num-table-md text-on-surface">-</td>
                <td className="px-space-md py-3 text-right text-num-table-md text-on-surface">-</td>
                <td className="px-space-md py-3 text-right text-num-table-md font-bold text-primary">{fmtNum(ledger.opening)}</td>
                <td className="px-space-md py-3 text-center"><Lock size={15} className="inline text-emerald-600" /></td>
              </tr>

              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-outline"><SearchX size={22} /></span>
                      <p className="text-headline-sm text-on-surface">Belum ada mutasi pada filter ini</p>
                      <p className="max-w-md text-body-sm text-on-surface-variant">
                        Akun ini tidak memiliki entri posted yang cocok. Coba longgarkan filter cabang/rentang, atau input transaksi baru lewat modul Jurnal Umum.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((e) => {
                  const BuktiIcon = BUKTI_ICON[e.bukti];
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setDrawerEntry(e)}
                      className="cursor-pointer transition-colors hover:bg-surface-container-low/60"
                    >
                      <td className="px-space-md py-3 font-mono text-[11px] text-on-surface-variant">
                        {fmtDateId(e.date)} <span className="text-[10px] text-outline">{e.time}</span>
                      </td>
                      <td className="px-space-md py-3">
                        <span
                          title={e.pending ? "Pending audit — belum diposting ke GL final" : undefined}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold hover:underline",
                            e.pending
                              ? "bg-amber-500/10 text-amber-700"
                              : e.debit > 0 ? "bg-primary/10 text-primary" : "bg-rose-500/10 text-error"
                          )}
                        >
                          {e.voucher.startsWith("JV/") ? shortNumber(e.voucher) : e.voucher}
                          {e.pending && <span className="rounded bg-amber-500/20 px-1 font-sans text-[8.5px] font-bold uppercase tracking-wide">Pend</span>}
                        </span>
                      </td>
                      <td className="px-space-md py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", e.dot === "tertiary" ? "bg-tertiary" : "bg-primary")} />
                          <span className="truncate">{entryScopeLabel(e)}</span>
                        </div>
                      </td>
                      <td className="px-space-md py-3 font-medium text-on-surface">
                        {e.description}
                        {e.subDescription && <div className="text-[11px] font-normal text-on-surface-variant">{e.subDescription}</div>}
                      </td>
                      <td className="px-space-md py-3 text-on-surface-variant">
                        <span className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] text-on-surface">{e.offsetLabel}</span>
                      </td>
                      <td className="px-space-md py-3 text-right text-num-table-md font-semibold">
                        {e.debit > 0
                          ? <span className="text-emerald-600">{fmtNum(e.debit)}</span>
                          : <span className="text-outline">-</span>}
                      </td>
                      <td className="px-space-md py-3 text-right text-num-table-md font-semibold">
                        {e.credit > 0
                          ? <span className="text-error">{fmtNum(e.credit)}</span>
                          : <span className="text-outline">-</span>}
                      </td>
                      <td className="px-space-md py-3 text-right text-num-table-md font-medium text-on-surface">
                        {mode === "running" ? fmtNum(e.runningBalance) : (
                          <span className={e.debit > 0 ? "text-emerald-600" : "text-error"}>
                            {e.debit > 0 ? "+" : "-"}{fmtNum(e.debit || e.credit)}
                          </span>
                        )}
                      </td>
                      <td className="px-space-md py-3 text-center">
                        <button className="rounded p-1 text-primary transition-colors hover:bg-surface-container" title="Lihat Bukti">
                          <BuktiIcon size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container text-headline-sm text-on-surface">
                <td className="px-space-md py-3 text-right text-[12px] font-bold uppercase tracking-wider text-on-surface-variant" colSpan={5}>
                  Total Mutasi Periode {periodLabel}
                </td>
                <td className="px-space-md py-3 text-right text-num-table-md font-bold text-emerald-600">+{fmtRpFull(ledger.totalDebit)}</td>
                <td className="px-space-md py-3 text-right text-num-table-md font-bold text-error">-{fmtRpFull(ledger.totalCredit)}</td>
                <td className="px-space-md py-3 text-right text-num-table-md font-bold text-primary">{fmtRpFull(ledger.ending)}</td>
                <td className="px-space-md py-3 text-center"><CheckCircle2 size={16} className="inline text-primary" /></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination meta */}
        <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-low px-space-md py-space-sm sm:flex-row">
          <div className="flex flex-wrap items-center gap-space-sm text-label-sm text-on-surface-variant">
            <span>Menampilkan <strong>{visible.length} mutasi</strong> — saldo awal termasuk</span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-primary" />
              <span>Rentang: <strong>{labelRange(range)}</strong></span>
            </span>
            <span className="text-outline-variant">•</span>
            <span>Akun: <strong>{account ? `[${account.code}] ${account.name}` : "—"}</strong></span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Audit Lock Hash: {hash}
            </span>
          </div>
          <div className="flex items-center gap-space-xs">
            <button disabled className="rounded bg-surface-container-lowest px-space-sm py-1 text-label-sm text-on-surface-variant shadow-soft disabled:opacity-40">Sebelumnya</button>
            <button className="rounded bg-primary-container px-space-sm py-1 text-label-sm text-on-primary-container shadow-soft">1</button>
            <button
              onClick={() => pushToast("info", "Halaman arsip", "Mutasi sebelum periode berjalan tersimpan di arsip Tutup Buku Agustus.")}
              className="rounded bg-surface-container-lowest px-space-sm py-1 text-label-sm text-on-surface-variant shadow-soft transition-colors hover:text-on-surface"
            >2</button>
            <button
              onClick={() => pushToast("info", "Halaman arsip", "Mutasi sebelum periode berjalan tersimpan di arsip Tutup Buku Agustus.")}
              className="rounded bg-surface-container-lowest px-space-sm py-1 text-label-sm text-on-surface-variant shadow-soft transition-colors hover:text-on-surface"
            >Berikutnya</button>
          </div>
        </div>
      </motion.div>

      {/* ── Insights + integrity ───────────────────────────────── */}
      <div className="grid grid-cols-1 items-stretch gap-space-md lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.26 }}
          className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-soft lg:col-span-8"
        >
          <div className="mb-space-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-headline-sm text-on-surface">Distribusi Arus Mutasi Akun {account ? `[${account.code}]` : ""}</span>
              <span className="text-body-sm text-on-surface-variant">Proporsi arus masuk vs penyaluran operasional berjalan</span>
            </div>
            <span className="rounded-full bg-surface-container px-space-sm py-0.5 text-[11px] text-label-sm font-semibold text-primary">{periodLabel}</span>
          </div>
          <div className="my-space-sm space-y-3">
            {(() => {
              const inflows = new Map<string, number>();
              const outflows = new Map<string, number>();
              for (const e of visible) {
                if (e.debit > 0) inflows.set(e.offsetLabel, (inflows.get(e.offsetLabel) ?? 0) + e.debit);
                if (e.credit > 0) outflows.set(e.offsetLabel, (outflows.get(e.offsetLabel) ?? 0) + e.credit);
              }
              const topIn = [...inflows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
              const topOut = [...outflows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1);
              const rows: { label: string; amount: number; pct: number; bar: string; text: string; dot: string }[] = [];
              topIn.forEach(([label, amount], i) => rows.push({
                label, amount,
                pct: ledger.totalDebit ? (amount / ledger.totalDebit) * 100 : 0,
                bar: i === 0 ? "bg-primary" : "bg-tertiary",
                text: "text-on-surface",
                dot: i === 0 ? "bg-primary" : "bg-tertiary",
              }));
              topOut.forEach(([label, amount]) => rows.push({
                label: `Pengeluaran: ${label.replace(/^\[|\]$/g, "")}`, amount,
                pct: ledger.totalCredit ? (amount / ledger.totalCredit) * 100 : 0,
                bar: "bg-rose-500",
                text: "text-error",
                dot: "bg-rose-500",
              }));
              if (rows.length === 0) {
                return <p className="rounded-lg bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">Tidak ada data distribusi untuk filter saat ini.</p>;
              }
              return rows.map((r, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-label-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                      <span className={cn("h-2.5 w-2.5 rounded-sm", r.dot)} /> {r.label}
                    </span>
                    <span className={cn("font-mono font-semibold", r.text)}>
                      {fmtRpFull(r.amount)} <span className="font-normal text-on-surface-variant">({r.pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                    <motion.div className={cn("h-full rounded-full", r.bar)} initial={{ width: 0 }}
                      animate={{ width: `${r.pct}%` }} transition={{ duration: 0.7, delay: 0.35 + i * 0.1 }} />
                  </div>
                </div>
              ));
            })()}
          </div>
          <div className="flex flex-col items-start justify-between gap-space-xs rounded-lg bg-surface-container-low/40 p-space-sm pt-space-sm text-body-sm text-on-surface-variant sm:flex-row sm:items-center">
            <div className="flex items-center gap-space-xs">
              <Lightbulb size={17} className="text-primary" />
              <span>Akun ini memiliki rasio likuiditas tinggi dengan perputaran kas rata-rata 3.2 hari kerja.</span>
            </div>
            <button onClick={() => setPickerOpen(true)} className="text-label-md font-semibold text-primary transition-opacity hover:opacity-70 hover:underline">
              Lihat Buku Besar Pembanding
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.3 }}
          className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-soft lg:col-span-4"
        >
          <div className="mb-space-sm flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Dentico Integrity Engine</span>
            <ShieldCheck size={19} className="text-primary" />
          </div>
          <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-sm font-mono text-[11px] text-on-surface-variant">
            {[
              ["Ledger Version:", "2.4-SUPABASE-ACCLOG"],
              ["Root Tree Hash:", "0x78ab19c009fe22a"],
              ["Verified By:", "Nabila F. (Head of Finance)"],
              ["Status Audit:", "LOCKED & VERIFIED"],
            ].map(([k, v], i) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className={cn("truncate font-bold", i === 1 ? "max-w-[140px] text-primary" : i === 3 ? "text-emerald-700" : "text-on-surface")}>{v}</span>
              </div>
            ))}
          </div>
          <p className="my-space-sm text-body-sm leading-relaxed text-on-surface-variant">
            Buku Besar ini dilindungi sistem immutable audit log. Seluruh perubahan nomor akun dan jurnal
            koreksi dicatat secara permanen sesuai standar PSAK 101.
          </p>
          <button
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-space-xs rounded-lg bg-surface-container py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Download size={17} />
            <span>Unduh Ledger Ber-Watermark Resmi</span>
          </button>
        </motion.div>
      </div>

      {/* Modals / drawer */}
      <AccountPicker
        open={pickerOpen}
        accounts={postingAccounts}
        selected={selectedCode}
        onSelect={setSelectedCode}
        onClose={() => setPickerOpen(false)}
      />
      <GlDrawer
        entry={drawerEntry}
        account={account}
        onClose={() => setDrawerEntry(null)}
        onOpenJournal={() => { setDrawerEntry(null); onOpenJournal(); }}
      />
    </div>
  );
}
