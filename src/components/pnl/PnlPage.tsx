import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight, FileText, Table2, Printer, ChevronDown, Landmark, Store,
  CalendarClock, ShieldCheck, BadgeCheck, Telescope, ArrowUpRight, Network,
} from "lucide-react";

import { fetchAccounts } from "../../data/coaRepository";
import { subscribeJournals, getJournals, initJournalStore } from "../../data/journalStore";
import { fetchPnlLines } from "../../data/pnlRepository";
import { buildLedger, GL_SUPPLEMENTS } from "../../data/ledger";
import {
  amountOf, computeStatement, getScopedPnlLines, BEBAN_CHILDREN,
  pnlPeriodMonths, pnlPeriodOptions,
  type PnlLine, type PnlPeriod, type PnlSection, type SectionKey,
} from "../../data/pnl";
import type { CoaAccount } from "../../data/coa";
import type { Journal } from "../../data/journal";
import { fmtRpFull } from "../../data/finance";
import { fmtDateId, shortNumber } from "../../data/journal";
import type { PushToast } from "../Toasts";
import { cn } from "../../utils/cn";
import { defaultPeriodKey, labelOfPeriod } from "../../utils/periods";
import useScopeStore from "../../hooks/useScopeStore";

/* ── Format helper ─────────────────────────────────────────────────── */
const fmtAmt = (v: number) => v === 0 ? "-" : fmtRpFull(Math.abs(v));
const fmtPct = (part: number, whole: number) => whole ? `${((part / whole) * 100).toFixed(1)}%` : "-";

function journalScopeLabel(j: Journal): string {
  if (j.branch.toLowerCase().includes(j.brand.toLowerCase())) return j.branch;
  return `${j.brand} - ${j.branch}`;
}

function matchesEntityFilter(filter: string, j: Journal): boolean {
  if (filter === "Dentico Group (Consolidated)") return true;
  return j.brand.toLowerCase().includes(filter.toLowerCase().split(" - ")[0]);
}

function matchesBranchFilter(filter: string, j: Journal): boolean {
  if (filter === "Semua Cabang (Grup)") return true;
  const scope = journalScopeLabel(j).toLowerCase();
  const tokens = filter.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.every((t) => scope.includes(t));
}

/* ═══════════════════════ Drill panel (right) ══════════════════════ */
function DrillPanel({ account, amount, periodLabel, journals, onOpenLedger }: {
  account: CoaAccount | null; amount: number; periodLabel: string; journals: Journal[]; onOpenLedger: (code: string) => void;
}) {
  const entries = useMemo(() => {
    if (!account) return [];
    return buildLedger(account, journals, GL_SUPPLEMENTS).entries.slice(-3).reverse();
  }, [account, journals]);

  return (
    <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-card xl:sticky xl:top-20">
      <div className="flex items-center justify-between pb-space-sm">
        <div className="flex items-center gap-space-xs">
          <span className="rounded bg-primary-container p-1 text-on-primary-container"><Telescope size={16} /></span>
          <span className="text-label-md uppercase tracking-wider text-on-surface">Drill-Down Buku Besar</span>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-space-xs py-0.5 text-[10px] text-label-sm font-bold text-emerald-700">AUDITED</span>
      </div>

      <div className="rounded-xl bg-surface-container-low p-space-md">
        <div className="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">Akun Terpilih</div>
        <AnimatePresence mode="wait">
          <motion.div key={account?.code ?? "-"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            <div className="text-headline-md font-bold text-primary">{account ? `${account.code} - ${account.name}` : "—"}</div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-space-sm flex items-center justify-between">
          <span className="text-body-sm text-on-surface-variant">Total periode {periodLabel}</span>
          <span className="text-headline-sm font-bold text-on-surface tnum">{fmtRpFull(amount)}</span>
        </div>
      </div>

      {/* Traceability */}
      <div className="rounded-lg bg-surface-container-lowest p-space-sm">
        <span className="mb-2 block text-label-sm uppercase tracking-wider text-outline">Jalur Audit (Traceability)</span>
        <div className="flex flex-col gap-1 text-[11px] text-label-sm">
          {[
            { n: 1, t: "Laporan Laba Rugi", cls: "bg-primary/10 text-primary" },
            { n: 2, t: `Kelompok Akun (${account?.typeLabel ?? ""})`, cls: "bg-primary/20 text-primary" },
            { n: 3, t: `Buku Besar: ${account?.code ?? "—"}`, cls: "bg-primary text-on-primary", strong: true },
            { n: 4, t: "Jurnal Asli & Bukti", cls: "bg-emerald-500 text-white", strong: true },
          ].map((s, i) => (
            <div key={s.n}>
              {i > 0 && <div className="ml-2 h-2 w-0.5 bg-surface-container-highest" />}
              <div className={cn("flex items-center gap-2", s.strong ? "font-semibold" : "text-on-surface-variant")}>
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold", s.cls)}>{s.n}</span>
                <span className={s.n === 3 ? "text-primary" : s.n === 4 ? "text-emerald-700" : "text-on-surface-variant"}>{s.t}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source entries */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between">
          <span className="text-label-sm uppercase tracking-wider text-outline">{entries.length} Mutasi Terbaru</span>
          {account && (
            <button onClick={() => onOpenLedger(account.code)} className="flex items-center gap-0.5 text-label-sm text-primary hover:opacity-70">
              Buka Ledger Full <ArrowUpRight size={12} />
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="rounded-lg bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
            Mutasi teragregasi oleh engine batch — detail tersedia di modul Buku Besar.
          </div>
        ) : entries.map((e) => (
          <div key={e.id} className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-space-sm transition-colors hover:bg-surface-container-high/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px]", e.debit > 0 ? "bg-primary text-on-primary" : "bg-rose-500 text-white")}>
                  {e.voucher.startsWith("JV/") ? shortNumber(e.voucher) : e.voucher}
                </span>
                <span className="text-body-sm text-outline">{fmtDateId(e.date)}</span>
              </div>
              <span className="text-label-sm font-bold text-emerald-700">POSTED</span>
            </div>
            <div className="text-label-md font-medium leading-tight text-on-surface">{e.description}</div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[11px] text-body-sm text-on-surface-variant">
                {e.journal ? `${e.journal.operatorName}` : "Ledger Engine"}
              </span>
              <span className="text-num-table-md font-bold text-on-surface">{fmtRpFull(e.debit || e.credit)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-high p-space-sm">
        <BadgeCheck size={22} className="shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-label-sm font-bold text-on-surface">100% Terverifikasi Sistem</span>
          <span className="text-[11px] text-body-sm text-on-surface-variant">Seluruh saldo dari jurnal tersinkronisasi tanpa manual overwrite.</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Section row renderer ═════════════════════ */
function SectionBlock({ section, open, onToggle, selectedCode, onDrill, indent }: {
  section: PnlSection; open: boolean; onToggle: () => void; selectedCode: string | null; onDrill: (code: string) => void; indent: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg bg-surface-container-lowest shadow-soft transition-all", indent && "ml-4")}>
      <button onClick={onToggle}
        className="flex w-full items-center justify-between px-space-md py-3 text-left transition-colors hover:bg-surface-container-low">
        <div className="flex items-center gap-space-sm">
          <ChevronDown size={15} className={cn("text-outline transition-transform duration-200", !open && "-rotate-90")} />
          <span className={cn("text-label-md font-bold uppercase tracking-wide", section.color === "primary" ? "text-primary" : section.color === "amber" ? "text-amber-700" : "text-on-surface")}>
            {section.title}
          </span>
        </div>
        {!open && <span className="text-num-table-md font-bold text-on-surface tnum">{fmtAmt(section.total)}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="flex flex-col px-space-md pb-2">
              {section.rows.map((r) => {
                const sel = r.code === selectedCode;
                return (
                  <button key={r.code} onClick={() => r.drillable && onDrill(r.code)}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
                      sel ? "bg-primary/[0.07]" : "hover:bg-surface-container-low",
                      !r.drillable && "cursor-default"
                    )}>
                    <span className={cn("text-body-md", sel ? "font-semibold text-primary" : "text-on-surface", r.isIncome && section.key === "nonops" ? "text-emerald-700" : "")}>
                      {r.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-num-table-md font-semibold tnum", sel ? "text-primary" : "text-on-surface", r.amount === 0 && "text-outline")}>
                        {fmtAmt(r.amount)}
                      </span>
                      <span className={cn(
                        "rounded p-0.5 transition-all",
                        r.drillable
                          ? (sel ? "bg-primary text-on-primary opacity-100" : "text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-surface-container-high")
                          : "text-outline/40"
                      )}>
                        <Network size={13} />
                      </span>
                    </div>
                  </button>
                );
              })}
              {/* Subtotal */}
              <div className="mt-1 flex items-center justify-between border-t border-surface-container px-3 py-2">
                <span className={cn("text-label-md font-bold", section.color === "primary" ? "text-primary" : section.color === "amber" ? "text-amber-700" : "text-on-surface")}>
                  {section.key === "pendapatan" ? "TOTAL PENDAPATAN" : section.key === "langsung" ? "TOTAL BEBAN LANGSUNG" : section.key === "nonops" ? "TOTAL PENDAPATAN / BEBAN NON-OPERASIONAL" : `Total ${section.title.replace("BIAYA ", "")}`}
                </span>
                <span className="text-num-table-md font-bold text-on-surface tnum">{fmtAmt(Math.abs(section.total))}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════ Main page ═════════════════════════════════ */
interface PnlPageProps { pushToast: PushToast; onOpenLedger: (code: string) => void }

export default function PnlPage({ pushToast, onOpenLedger }: PnlPageProps) {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [lines, setLines] = useState<PnlLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState("Dentico Group (Consolidated)");
  const [branch, setBranch] = useState("Semua Cabang (Grup)");
  const [period, setPeriod] = useState<PnlPeriod>("");
  const scope = useScopeStore();
  const [selectedCode, setSelectedCode] = useState<string>("6201");
  const [openMap, setOpenMap] = useState<Record<SectionKey, boolean>>({
    pendapatan: true, langsung: true, sdm: true, ops: true, maint: false, adm: false, mkt: false, nonops: true,
  });

  useEffect(() => {
    initJournalStore();
    let alive = true;
    (async () => {
      const [a, p] = await Promise.all([fetchAccounts(), fetchPnlLines()]);
      if (!alive) return;
      setAccounts(a.data);
      setLines(p.data);
      setJournals(getJournals());
      setLoading(false);
    })();
    const unsub = subscribeJournals(() => setJournals(getJournals()));
    return () => { alive = false; unsub(); };
  }, []);

  /**
   * Periode & bulan tersedia, diturunkan dari jurnal + tabel postings +
   * bulan berjalan. Jurnal Oktober langsung memunculkan opsi "Oktober 2026".
   */
  const availableMonths = useMemo(() => pnlPeriodMonths(journals, lines), [journals, lines]);
  const periodOpts = useMemo(() => pnlPeriodOptions(journals, lines), [journals, lines]);

  /** Jaga agar periode terpilih selalu tersedia di daftar opsi. */
  useEffect(() => {
    if (periodOpts.length === 0) return;
    if (!period || !periodOpts.some((o) => o.key === period)) setPeriod(defaultPeriodKey(availableMonths));
  }, [periodOpts, period, availableMonths]);

  const effectiveLines = useMemo(
    () => getScopedPnlLines(lines, journals, entity, branch, availableMonths),
    [lines, journals, entity, branch, availableMonths]
  );

  const st = useMemo(
    () => computeStatement(effectiveLines, accounts, period, availableMonths),
    [effectiveLines, accounts, period, availableMonths]
  );
  const selAccount = useMemo(() => accounts.find((a) => a.code === selectedCode) ?? null, [accounts, selectedCode]);
  const selAmount = useMemo(() => {
    const line = effectiveLines.find((l) => l.code === selectedCode);
    if (!line) return 0;
    return amountOf(line, period, availableMonths);
  }, [effectiveLines, selectedCode, period, availableMonths]);

  const scopedMode = entity !== "Dentico Group (Consolidated)" || branch !== "Semua Cabang (Grup)";
  const scopedPostedJournals = useMemo(() => {
    if (!scopedMode) return journals;
    return journals.filter((j) => j.status === "POSTED" && matchesEntityFilter(entity, j) && matchesBranchFilter(branch, j));
  }, [journals, scopedMode, entity, branch]);

  const periodLabel = period ? labelOfPeriod(period, availableMonths) : "—";
  const sec = (k: SectionKey) => st.sections.find((s) => s.key === k)!;
  const toggleSection = (k: SectionKey) => setOpenMap((m) => ({ ...m, [k]: !m[k] }));
  const setAll = (v: boolean) => setOpenMap((m) => Object.fromEntries(Object.keys(m).map((k) => [k, v])) as Record<SectionKey, boolean>);

  const handleExport = () => {
    const rows: string[] = ["seksi,kode,nama_akun,jumlah"];
    for (const s of st.sections) for (const r of s.rows) rows.push(`"${s.title}",${r.code},"${r.name}",${r.amount}`);
    rows.push(`,,LABA KOTOR,${st.labaKotor}`);
    rows.push(`,,TOTAL BEBAN OPERASIONAL,${st.bebanOps}`);
    rows.push(`,,LABA OPERASIONAL,${st.labaOperasional}`);
    rows.push(`,,LABA BERSIH,${st.labaBersih}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `dentico-laba-rugi-${period.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Laporan diekspor", `Income statement ${periodLabel} ke CSV.`);
  };

  if (loading) return (
    <div className="flex flex-col gap-space-lg">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-container-lowest shadow-soft" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );

  return (
    <div className="relative flex w-full flex-col gap-space-lg">
      <div className="pointer-events-none absolute -top-10 left-1/3 -z-10 h-80 w-80 rounded-full bg-primary-container/10 blur-3xl" aria-hidden />

      {/* Breadcrumb */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs text-label-sm text-on-surface-variant">
          <span>Laporan Keuangan</span>
          <ChevronRight size={13} className="text-outline" />
          <span className="font-semibold text-primary">Laba Rugi (P&L)</span>
        </div>
        <div className="flex items-center gap-space-xs rounded-full bg-surface-container-low px-space-sm py-1 text-label-sm text-on-surface-variant">
          <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-emerald-500" />
          <span className="font-semibold text-on-surface">Status:</span>
          <span className="text-primary">100% POSTED Entri Otomatis</span>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.04 }} className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-end">
        <div>
          <h1 className="text-headline-xl tracking-tight text-on-surface">Laporan Laba Rugi <span className="text-headline-md font-semibold text-primary">(Income Statement)</span></h1>
          <p className="mt-1 max-w-3xl text-body-md text-on-surface-variant">
            Laporan otomatis dari Jurnal POSTED dengan drill-down langsung ke Buku Besar dan dokumen sumber transaksi.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-space-xs">
          <button onClick={() => pushToast("info", "Export PDF", "PDF ber-watermark tersedia pada rilis penuh.")} className="flex items-center gap-space-xs rounded-lg border border-surface-container bg-surface-container-lowest px-space-md py-2 text-label-md shadow-soft hover:bg-surface-container-low active:scale-[0.98]">
            <FileText size={17} className="text-error" /> Export PDF
          </button>
          <button onClick={handleExport} className="flex items-center gap-space-xs rounded-lg border border-surface-container bg-surface-container-lowest px-space-md py-2 text-label-md shadow-soft hover:bg-surface-container-low active:scale-[0.98]">
            <Table2 size={17} className="text-emerald-600" /> Excel (CSV)
          </button>
          <button onClick={() => pushToast("info", "Cetak", "Format A4 tersedia pada rilis penuh.")} className="rounded-lg border border-surface-container bg-surface-container-lowest px-space-sm py-2 shadow-soft hover:bg-surface-container-low" title="Cetak"><Printer size={17} /></button>
        </div>
      </motion.div>

      {/* Filter */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }} className="rounded-xl bg-surface-container-lowest p-space-md shadow-soft">
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-outline"><Landmark size={13} className="text-primary" /> Entitas</label>
            <div className="relative">
              <select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low px-space-sm py-2 text-label-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50">
                {scope.brandFilterOpts.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-space-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-outline"><Store size={13} className="text-primary" /> Cabang</label>
            <div className="relative">
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low px-space-sm py-2 text-label-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50">
                {scope.cabangFilterOpts.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-space-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-outline"><CalendarClock size={13} className="text-primary" /> Periode</label>
            <div className="relative">
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low px-space-sm py-2 text-label-md font-bold text-primary outline-none focus:ring-2 focus:ring-primary/50">
                {periodOpts.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-space-sm top-1/2 -translate-y-1/2 text-primary" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-outline"><ShieldCheck size={13} className="text-primary" /> Metode</label>
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-space-sm py-2 text-label-md text-on-surface">
              <span className="truncate">Akrual (Dentico Standard)</span>
              <span className="shrink-0 rounded bg-primary px-space-xs py-0.5 text-[10px] text-on-primary">PSAK</span>
            </div>
          </div>
        </div>
      </motion.div>

      {scopedMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="flex flex-col justify-between gap-space-sm rounded-xl border border-primary/15 bg-primary/[0.04] p-space-md shadow-soft sm:flex-row sm:items-center"
        >
          <div className="flex flex-col">
            <span className="text-label-md font-semibold text-on-surface">
              Scope aktif: {entity} • {branch}
            </span>
            <span className="text-body-sm text-on-surface-variant">
              Nilai P&L kini dihitung dari <strong>jurnal POSTED</strong> yang cocok dengan entitas/cabang terpilih — termasuk JV yang baru diposting seperti JV-0143.
            </span>
          </div>
          <button
            onClick={() => { setEntity("Dentico Group (Consolidated)"); setBranch("Semua Cabang (Grup)"); }}
            className="shrink-0 rounded-lg bg-primary-container px-space-sm py-1.5 text-label-sm font-bold text-on-primary-container transition-colors hover:bg-secondary"
          >
            Reset ke Konsolidasi
          </button>
        </motion.div>
      )}

      {/* ── Statement + drill panel ───────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.14 }} className="flex flex-col gap-space-md lg:col-span-8">
          {/* Toolbar */}
          <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-space-md py-2.5">
            <span className="text-label-md text-on-surface">LAPORAN LABA RUGI — <span className="text-primary">{periodLabel}</span></span>
            <div className="flex items-center gap-space-xs">
              <button onClick={() => setAll(false)} className="px-2 py-1 text-label-sm text-primary hover:underline">Tutup Semua</button>
              <span className="text-[12px] text-outline">•</span>
              <button onClick={() => setAll(true)} className="px-2 py-1 text-label-sm text-primary hover:underline">Buka Semua</button>
            </div>
          </div>

          {/* 1. PENDAPATAN USAHA */}
          <SectionBlock section={sec("pendapatan")} open={openMap.pendapatan} onToggle={() => toggleSection("pendapatan")} selectedCode={selectedCode} onDrill={setSelectedCode} indent={false} />

          {/* 2. BIAYA LANGSUNG */}
          <SectionBlock section={sec("langsung")} open={openMap.langsung} onToggle={() => toggleSection("langsung")} selectedCode={selectedCode} onDrill={setSelectedCode} indent={false} />

          {/* ── LABA KOTOR ── */}
          <div className="flex items-center justify-between rounded-xl bg-surface-container-high px-space-md py-3 shadow-soft">
            <span className="text-headline-sm font-bold text-on-surface">LABA KOTOR</span>
            <span className="text-headline-sm font-bold text-primary tnum">{fmtRpFull(st.labaKotor)}</span>
          </div>

          {/* ── BEBAN OPERASIONAL group ── */}
          <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-soft">
            <span className="mb-3 block text-label-md font-bold uppercase tracking-wider text-on-surface">BEBAN OPERASIONAL</span>
            <div className="flex flex-col gap-space-sm">
              {BEBAN_CHILDREN.map((k) => (
                <SectionBlock key={k} section={sec(k)} open={openMap[k]} onToggle={() => toggleSection(k)} selectedCode={selectedCode} onDrill={setSelectedCode} indent={true} />
              ))}
            </div>
            {/* TOTAL BEBAN OPERASIONAL */}
            <div className="mt-space-md flex items-center justify-between border-t-2 border-on-surface px-3 pt-3">
              <span className="text-label-md font-bold uppercase text-on-surface">TOTAL BEBAN OPERASIONAL</span>
              <span className="text-num-table-md font-bold text-on-surface tnum">{fmtAmt(st.bebanOps)}</span>
            </div>
          </div>

          {/* ── LABA OPERASIONAL ── */}
          <div className="flex items-center justify-between rounded-xl bg-surface-container-high px-space-md py-3 shadow-soft">
            <span className="text-headline-sm font-bold text-on-surface">LABA OPERASIONAL</span>
            <span className="text-headline-sm font-bold text-primary tnum">{fmtRpFull(st.labaOperasional)}</span>
          </div>

          {/* 8. PENDAPATAN / BEBAN NON-OPERASIONAL */}
          <SectionBlock section={sec("nonops")} open={openMap.nonops} onToggle={() => toggleSection("nonops")} selectedCode={selectedCode} onDrill={setSelectedCode} indent={false} />

          {/* ── LABA BERSIH ── */}
          <div className="flex flex-col justify-between gap-space-md rounded-xl bg-primary p-space-lg text-on-primary shadow-pop sm:flex-row sm:items-center">
            <div>
              <span className="mb-1 block text-label-sm font-bold uppercase tracking-wider text-primary-fixed">Bottom Line</span>
              <h2 className="text-headline-xl font-bold tracking-tight">LABA BERSIH</h2>
              <p className="mt-1 text-body-sm text-primary-fixed">
                Laba Operasional {st.nonOpsNet >= 0 ? "+" : "−"} Pendapatan/Beban Non-Operasional
              </p>
            </div>
            <div className="text-right">
              <div className="text-display-lg font-bold tnum">{fmtRpFull(st.labaBersih)}</div>
              <div className="text-label-md font-semibold text-primary-fixed">{fmtPct(st.labaBersih, st.pendapatan)} Net Margin</div>
            </div>
          </div>
        </motion.div>

        {/* Drill panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="lg:col-span-4">
          <DrillPanel account={selAccount} amount={selAmount} periodLabel={periodLabel} journals={scopedMode ? scopedPostedJournals : journals} onOpenLedger={onOpenLedger} />
        </motion.div>
      </div>

      <div className="flex items-center justify-between border-t border-surface-container pt-space-md text-[11px] text-body-sm text-outline">
        <span>Dentico Finance Core v2.4 · Laporan Laba Rugi · PSAK Accrual</span>
        <span>Drill-down ke Buku Besar tersedia pada setiap baris akun</span>
      </div>
    </div>
  );
}
