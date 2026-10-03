import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, ListFilter, Download, Lightbulb, Lock, History, Eye, Check, X,
  Trash2, FilePenLine, BadgeCheck, SearchX,
} from "lucide-react";
import { fmtRpFull } from "../../data/finance";
import {
  JOURNAL_TYPE_SHORT, STATUS_STYLE, fmtDateId, operatorColor, shortNumber,
  type Journal, type JournalStatus,
} from "../../data/journal";
import { cn } from "../../utils/cn";
import type { PushToast } from "../Toasts";

export type RegistryFilter = "ALL" | JournalStatus | "LOCKED";

interface JournalRegistryProps {
  journals: Journal[];
  filter: RegistryFilter;
  onFilterChange: (f: RegistryFilter) => void;
  onView: (j: Journal) => void;
  onEdit: (j: Journal) => void;
  onApprove: (j: Journal) => void;
  onReject: (j: Journal) => void;
  onPost: (j: Journal) => void;
  onDelete: (j: Journal) => void;
  pushToast: PushToast;
}

function StatusBadge({ status }: { status: JournalStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-label-sm font-bold", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot, s.animate && "animate-pulse-dot")} />
      {status}
    </span>
  );
}

export default function JournalRegistry({
  journals, filter, onFilterChange, onView, onEdit, onApprove, onReject, onPost, onDelete, pushToast,
}: JournalRegistryProps) {
  const [search, setSearch] = useState("");

  const counts = useMemo(() => ({
    ALL: journals.length,
    DRAFT: journals.filter((j) => j.status === "DRAFT").length,
    REVIEW: journals.filter((j) => j.status === "REVIEW").length,
    APPROVED: journals.filter((j) => j.status === "APPROVED").length,
    POSTED: journals.filter((j) => j.status === "POSTED").length,
  }), [journals]);

  const filtered = useMemo(() => {
    let list = journals;
    if (filter === "LOCKED") return [];
    if (filter !== "ALL") list = list.filter((j) => j.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((j) =>
        `${j.number} ${j.reference} ${j.description} ${j.operatorName} ${j.brand} ${j.branch} ${j.total}`
          .toLowerCase().includes(q)
      );
    }
    return list;
  }, [journals, filter, search]);

  const handleExport = () => {
    const header = "number,date,type,brand,branch,reference,description,total,status,operator,lines";
    const rows = filtered.map((j) =>
      [j.number, j.date, j.type, j.brand, j.branch, j.reference, `"${j.description.replace(/"/g, '""')}"`, j.total, j.status, j.operatorName, j.lines.length].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentico-jurnal-registry.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Registry diekspor", `${filtered.length} jurnal diekspor ke CSV.`);
  };

  const TABS: { key: RegistryFilter; label: string }[] = [
    { key: "ALL", label: `Semua (${counts.ALL})` },
    { key: "DRAFT", label: `Draft (${counts.DRAFT})` },
    { key: "REVIEW", label: `Review (${counts.REVIEW})` },
    { key: "APPROVED", label: `Approved (${counts.APPROVED})` },
    { key: "POSTED", label: `Posted (${counts.POSTED})` },
    { key: "LOCKED", label: "Locked Agt '26" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}
      className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-soft"
    >
      {/* Header + tabs */}
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div>
          <h3 className="text-headline-md text-on-surface">Daftar Jurnal Terkini (Journal Registry)</h3>
          <p className="text-body-sm text-on-surface-variant">
            Arsip mutasi dan pembukuan periode September 2026 terverifikasi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface-container-low p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onFilterChange(t.key)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-space-sm py-1 text-label-md transition-all",
                filter === t.key
                  ? "bg-surface-container-lowest text-primary shadow-soft"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {t.key === "LOCKED" && <Lock size={12} />}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + tools */}
      <div className="flex flex-col items-center justify-between gap-space-sm sm:flex-row">
        <div className="flex w-full items-center gap-2 rounded-xl border border-transparent bg-surface-container-low px-space-md py-1.5 transition-all focus-within:border-primary/30 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/40 sm:w-80">
          <Search size={17} className="text-outline" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari No. Jurnal, Ref, Nominal…"
            className="w-full bg-transparent text-body-sm text-on-surface outline-none placeholder:text-outline"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => pushToast("info", "Filter Lanjutan", "Filter periode, operator & rentang nominal tersedia di rilis penuh.")}
            className="flex items-center gap-1 rounded-lg bg-surface-container-low px-space-sm py-1.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <ListFilter size={15} /> <span>Filter Lanjutan</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-lg bg-surface-container-low px-space-sm py-1.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Download size={15} /> <span>Export XLS</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-surface-container-low/50">
        <table className="w-full min-w-[1020px] text-left">
          <thead>
            <tr className="bg-surface-container-low text-label-sm uppercase tracking-wider text-on-surface-variant">
              <th className="px-4 py-3">No. Jurnal</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Entitas & Cabang</th>
              <th className="px-4 py-3">Jenis Transaksi</th>
              <th className="px-4 py-3">Referensi</th>
              <th className="px-4 py-3 text-right">Nominal (IDR)</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-body-md text-on-surface">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-outline">
                      {filter === "LOCKED" ? <Lock size={22} /> : <SearchX size={22} />}
                    </span>
                    <p className="text-headline-sm text-on-surface">
                      {filter === "LOCKED" ? "Periode Agustus 2026 telah ditutup" : "Tidak ada jurnal yang cocok"}
                    </p>
                    <p className="max-w-md text-body-sm text-on-surface-variant">
                      {filter === "LOCKED"
                        ? "Jurnal pada periode terkunci hanya dapat dibaca lewat arsip Tutup Buku. Gunakan filter Posted untuk melihat histori."
                        : "Coba ubah kata kunci pencarian atau pindah tab status."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((j) => (
                <tr key={j.id} className="transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-3 text-num-table-md font-semibold text-primary">{shortNumber(j.number)}</td>
                  <td className="px-4 py-3 text-num-table-md text-on-surface-variant">{fmtDateId(j.date)}</td>
                  <td className="px-4 py-3">
                    <span className="block text-label-md text-on-surface">{j.brand}</span>
                    <span className="text-body-sm text-on-surface-variant">{j.branch}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface">
                      {JOURNAL_TYPE_SHORT[j.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-num-table-md text-outline">{j.reference || "—"}</td>
                  <td className="px-4 py-3 text-right text-num-table-md font-bold text-on-surface">{fmtRpFull(j.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-label-sm font-bold", operatorColor(j.operatorInitials))}>
                        {j.operatorInitials}
                      </span>
                      <span className="text-label-md">{j.operatorName}{j.operatorRole === "Staff" ? " (Staff)" : ""}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={j.status} /></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {j.status === "POSTED" && (
                        <>
                          <button
                            onClick={() => onView(j)}
                            className="flex items-center gap-1 rounded-lg bg-surface-container-high px-2.5 py-1 text-label-sm font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                          >
                            <Eye size={13} /> Detail
                          </button>
                          <button
                            onClick={() => pushToast("info", `Audit Trail · ${shortNumber(j.number)}`, "Riwayat immutable log tersimpan di Supabase (audit_log).")}
                            className="rounded-lg bg-surface-container-low p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                            title="Audit Trail"
                          >
                            <History size={15} />
                          </button>
                        </>
                      )}
                      {j.status === "REVIEW" && (
                        <>
                          <button
                            onClick={() => onApprove(j)}
                            className="flex items-center gap-1 rounded-lg bg-primary-container px-2.5 py-1 text-label-sm font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary"
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            onClick={() => onView(j)}
                            className="rounded-lg bg-surface-container-low p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                            title="Lihat Detail"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => onReject(j)}
                            className="rounded-lg p-1.5 text-outline transition-colors hover:bg-error-container/30 hover:text-error"
                            title="Tolak (kembali ke Draft)"
                          >
                            <X size={15} />
                          </button>
                        </>
                      )}
                      {j.status === "APPROVED" && (
                        <>
                          <button
                            onClick={() => onPost(j)}
                            className="flex items-center gap-1 rounded-lg bg-primary-container px-2.5 py-1 text-label-sm font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary"
                          >
                            <BadgeCheck size={13} /> Post ke GL
                          </button>
                          <button
                            onClick={() => onView(j)}
                            className="rounded-lg bg-surface-container-low p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                            title="Lihat Detail"
                          >
                            <Eye size={15} />
                          </button>
                        </>
                      )}
                      {j.status === "DRAFT" && (
                        <>
                          <button
                            onClick={() => onEdit(j)}
                            className="flex items-center gap-1 rounded-lg bg-surface-container-low px-2.5 py-1 text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high hover:text-primary"
                          >
                            <FilePenLine size={13} /> Edit Jurnal
                          </button>
                          <button
                            onClick={() => onDelete(j)}
                            className="rounded-lg p-1.5 text-outline transition-colors hover:bg-error-container/30 hover:text-error"
                            title="Hapus Draft"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reversal notice */}
      <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
        <Lightbulb size={20} className="mt-0.5 shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-label-md font-semibold text-on-surface">Kebijakan Integritas Audit Trail Keuangan</span>
          <p className="text-body-sm text-on-surface-variant">
            Catatan Audit: Jurnal berstatus <strong className="font-semibold text-on-surface">POSTED</strong> terkunci secara
            otomatis dari edit langsung guna memenuhi standar akuntansi klinik terakreditasi. Lakukan fitur{" "}
            <button
              onClick={() => pushToast("info", "Jurnal Reversal", "Buat jurnal koreksi baru yang mereferensikan jurnal POSTED — tersedia di rilis berikutnya.")}
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
            >
              Buat Jurnal Reversal / Koreksi Baru
            </button>{" "}
            untuk penyesuaian catatan pembukuan.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
