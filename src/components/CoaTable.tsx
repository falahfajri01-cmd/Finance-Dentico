import { motion } from "framer-motion";
import {
  Network, ChevronDown, ChevronsUpDown, ChevronsDownUp, Lock, Pencil,
  CirclePlus, SearchX, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  pillarOf, PILLAR_CODE_COLOR, PILLAR_CHIP_CLASSES, fmtCount, type CoaAccount,
} from "../data/coa";
import { cn } from "../utils/cn";

export interface DisplayRow {
  kind: "header" | "child";
  account: CoaAccount;
  /** number of visible children (header rows only) */
  childCount?: number;
}

interface CoaTableProps {
  rows: DisplayRow[];
  loading: boolean;
  grouped: boolean;
  expanded: Set<string>;
  onToggleExpand: (code: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  selectedId: string | null;
  onSelect: (a: CoaAccount) => void;
  onAddChild: (header: CoaAccount) => void;
  shownCount: number;
  matchedCount: number;
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onResetFilters: () => void;
}

/* ── Small cell atoms ──────────────────────────────────────────────── */
function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-label-sm font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] text-label-sm font-semibold text-on-surface-variant">
      <span className="h-1.5 w-1.5 rounded-full bg-outline" /> Nonaktif
    </span>
  );
}

function PostingChip({ canPost }: { canPost: boolean }) {
  return canPost ? (
    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-label-sm font-semibold text-emerald-700">
      Ya (Jurnal)
    </span>
  ) : (
    <span className="rounded bg-surface-container-highest px-2 py-0.5 text-[10px] text-label-sm text-on-surface-variant">
      Induk (No)
    </span>
  );
}

function NormalCell({ normal }: { normal: string }) {
  return (
    <span className={cn("text-num-table-md", normal === "Debit" ? "text-emerald-700" : "font-semibold text-secondary")}>
      {normal}
    </span>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 9 }).map((_, i) => (
        <tr key={i} className="border-b border-surface-container-low">
          {["w-10", "w-44", "w-24", "w-28", "w-10", "w-14", "w-14", "w-12"].map((w, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className={cn("h-3.5 animate-pulse rounded bg-surface-container-high", w, j === 0 && i > 0 && "ml-4")}
                style={{ animationDelay: `${i * 90}ms` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── Pagination window helper ──────────────────────────────────────── */
function pageWindow(page: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, page - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function CoaTable({
  rows, loading, grouped, expanded, onToggleExpand, onExpandAll, onCollapseAll,
  selectedId, onSelect, onAddChild, shownCount, matchedCount, totalCount,
  page, totalPages, onPageChange, onResetFilters,
}: CoaTableProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-soft">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-surface-container-low px-space-md py-space-sm">
        <div className="flex items-center gap-space-xs text-label-md text-on-surface">
          <Network size={17} className="text-primary" />
          <span>Struktur Hierarki Akun</span>
          <span className="text-body-sm font-normal text-on-surface-variant">
            ({fmtCount(matchedCount)} Akun Ditampilkan)
          </span>
        </div>
        <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
          <button
            onClick={onExpandAll}
            disabled={!grouped}
            className="flex items-center gap-1 transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronsUpDown size={15} />
            <span>Buka Semua</span>
          </button>
          <span className="text-outline-variant">•</span>
          <button
            onClick={onCollapseAll}
            disabled={!grouped}
            className="flex items-center gap-1 transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronsDownUp size={15} />
            <span>Tutup Semua</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low text-label-sm uppercase tracking-wider text-on-surface-variant">
              <th className="px-4 py-3 font-semibold">Kode Akun</th>
              <th className="px-4 py-3 font-semibold">Nama Akun</th>
              <th className="px-4 py-3 font-semibold">Kategori / Tipe</th>
              <th className="px-4 py-3 font-semibold">Parent Account</th>
              <th className="px-4 py-3 text-center font-semibold">Normal</th>
              <th className="px-4 py-3 text-center font-semibold">Posting</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-body-sm">
            {loading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-low text-outline">
                      <SearchX size={26} />
                    </span>
                    <div>
                      <p className="text-headline-sm text-on-surface">Tidak ada akun yang cocok</p>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        Coba ubah kata kunci pencarian atau reset filter kategori.
                      </p>
                    </div>
                    <button
                      onClick={onResetFilters}
                      className="mt-1 rounded-lg bg-primary-container px-4 py-2 text-label-md text-on-primary shadow-card transition-transform hover:opacity-95 active:scale-95"
                    >
                      Reset Semua Filter
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(({ kind, account: a, childCount }) => {
                const pillar = pillarOf(a);
                const selected = a.id === selectedId;
                if (kind === "header") {
                  const isOpen = expanded.has(a.code);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className={cn(
                        "cursor-pointer font-semibold text-on-surface transition-colors",
                        selected ? "bg-surface-container/80 shadow-[inset_4px_0_0_0_var(--color-primary)]" : "bg-surface-container-low/50 hover:bg-surface-container-high/70"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleExpand(a.code); }}
                            className="rounded p-0.5 text-outline transition-all hover:bg-surface-container-highest hover:text-on-surface"
                            aria-label={isOpen ? "Tutup grup" : "Buka grup"}
                          >
                            <ChevronDown size={16} className={cn("transition-transform duration-200", !isOpen && "-rotate-90")} />
                          </button>
                          <span className={cn("text-num-table-md font-bold", PILLAR_CODE_COLOR[pillar])}>{a.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-display font-bold tracking-wide">{a.name}</span>
                          {typeof childCount === "number" && (
                            <span className="rounded-full bg-surface-container-highest px-1.5 py-px text-[10px] font-bold text-on-surface-variant tnum">
                              {childCount} akun
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] text-label-sm font-bold", PILLAR_CHIP_CLASSES[pillar])}>
                          Header {pillar}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-label-sm text-outline">— Root —</td>
                      <td className="px-4 py-3 text-center"><NormalCell normal={a.normal} /></td>
                      <td className="px-4 py-3 text-center"><PostingChip canPost={false} /></td>
                      <td className="px-4 py-3 text-center"><StatusBadge active={a.isActive} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddChild(a); }}
                          title="Tambah Sub Akun"
                          className="rounded p-1 text-on-surface-variant transition-all hover:bg-surface-container-highest hover:text-primary active:scale-90"
                        >
                          <CirclePlus size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                /* child row */
                return (
                  <tr
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      selected
                        ? "bg-surface-container/80 shadow-[inset_4px_0_0_0_var(--color-primary)]"
                        : "hover:bg-surface-container-low/60"
                    )}
                  >
                    <td className="relative py-3 pl-10 pr-4">
                      {grouped && (
                        <>
                          <span aria-hidden className="absolute left-[21px] top-0 h-1/2 w-px bg-outline-variant/60" />
                          <span aria-hidden className="absolute left-[21px] top-1/2 h-px w-2.5 bg-outline-variant/60" />
                        </>
                      )}
                      <span className={cn("text-num-table-md font-semibold transition-colors", selected ? "font-bold text-primary" : cn(PILLAR_CODE_COLOR[pillar], "opacity-80 group-hover:opacity-100"))}>
                        {a.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium text-on-surface", a.typeLabel.startsWith("Kontra") && "italic")}>
                        {a.name}
                      </span>
                      {selected && (
                        <span className="ml-2 rounded bg-primary-container px-1.5 py-0.5 align-middle text-[10px] text-label-sm text-on-primary">
                          Terpilih
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-label-sm font-normal text-on-surface-variant">{a.typeLabel}</td>
                    <td className="px-4 py-3 text-[11px] text-label-sm font-normal text-on-surface-variant">{a.parentLabel ?? "—"}</td>
                    <td className="px-4 py-3 text-center"><NormalCell normal={a.normal} /></td>
                    <td className="px-4 py-3 text-center"><PostingChip canPost={a.canPost} /></td>
                    <td className="px-4 py-3 text-center"><StatusBadge active={a.isActive} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.isLocked ? (
                          <span title={`Proteksi: ${fmtCount(a.txCount)} jurnal terhubung`} className="cursor-help p-1 text-amber-500">
                            <Lock size={15} />
                          </span>
                        ) : (
                          <span title="Belum ada transaksi" className="p-1 text-outline-variant">
                            <Lock size={15} className="opacity-40" />
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelect(a); }}
                          title="Edit di panel detail"
                          className="rounded p-1 text-on-surface-variant opacity-40 transition-all hover:bg-surface-container-high hover:text-primary active:scale-90 group-hover:opacity-100"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-low px-space-md py-space-sm sm:flex-row">
        <span className="text-body-sm text-on-surface-variant">
          Menampilkan <span className="font-semibold text-on-surface">{shownCount}</span> dari{" "}
          <span className="font-semibold text-on-surface">{fmtCount(totalCount)}</span> akun COA Dentico
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface-variant shadow-soft transition-all hover:text-on-surface disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </button>
          {pageWindow(page, totalPages).map((p) => (
            <motion.button
              key={p}
              onClick={() => onPageChange(p)}
              whileTap={{ scale: 0.92 }}
              className={cn(
                "min-w-[2rem] rounded px-2.5 py-1.5 text-label-sm shadow-soft transition-colors tnum",
                p === page
                  ? "bg-primary-container font-bold text-on-primary shadow-card"
                  : "bg-surface-container-lowest text-on-surface hover:text-primary"
              )}
            >
              {p}
            </motion.button>
          ))}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface shadow-soft transition-all hover:text-primary disabled:opacity-40"
          >
            Berikutnya <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
