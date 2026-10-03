import { AnimatePresence, motion } from "framer-motion";
import { X, Hash, CheckCircle2, ShieldCheck } from "lucide-react";
import { fmtRpFull } from "../../data/finance";
import { JOURNAL_TYPE_SHORT, STATUS_STYLE, fmtDateId, operatorColor, shortNumber, totalOf, type Journal } from "../../data/journal";
import { cn } from "../../utils/cn";

export default function JournalDetailModal({ journal, onClose }: { journal: Journal | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {journal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-inverse-surface/45 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-pop"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-container px-space-lg py-space-md">
              <div className="flex min-w-0 items-center gap-space-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Hash size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-headline-sm font-bold text-on-surface">
                    {journal.number} · {JOURNAL_TYPE_SHORT[journal.type]}
                  </h3>
                  <p className="truncate text-[11.5px] text-body-sm text-on-surface-variant">
                    {fmtDateId(journal.date)} · {journal.brand} · {journal.branch} · Ref {journal.reference || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-label-sm font-bold", STATUS_STYLE[journal.status].chip)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLE[journal.status].dot)} />
                  {journal.status}
                </span>
                <button onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low" aria-label="Tutup">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[62vh] overflow-y-auto px-space-lg py-space-md scrollbar-none">
              <p className="text-body-md text-on-surface">{journal.description}</p>

              {/* Lines */}
              <div className="mt-space-md overflow-hidden rounded-xl bg-surface-container-low p-1">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                      <th className="px-3 py-2">Akun</th>
                      <th className="px-3 py-2">Keterangan</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.lines.map((l, i) => (
                      <tr key={i} className="border-t border-surface-container-lowest/60 text-body-sm text-on-surface">
                        <td className="px-3 py-2.5">
                          <span className="mr-1.5 rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-primary">
                            {l.accountCode}
                          </span>
                          {l.accountName}
                        </td>
                        <td className="px-3 py-2.5 text-on-surface-variant">{l.memo || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-num-table-md font-semibold">
                          {l.debit > 0 ? fmtRpFull(l.debit) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-num-table-md font-semibold">
                          {l.credit > 0 ? fmtRpFull(l.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const t = totalOf(journal.lines);
                      return (
                        <tr className="border-t-2 border-surface-container-high bg-surface-container-low/70 text-label-md">
                          <td className="px-3 py-2.5 font-bold" colSpan={2}>
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 size={15} className="text-emerald-600" /> Total (Balanced)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tnum">{fmtRpFull(t.debit)}</td>
                          <td className="px-3 py-2.5 text-right font-bold tnum">{fmtRpFull(t.credit)}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>

              {/* Operator & audit strip */}
              <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-sm">
                <div className="flex items-center gap-space-sm">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold", operatorColor(journal.operatorInitials))}>
                    {journal.operatorInitials}
                  </span>
                  <div>
                    <p className="text-label-md text-on-surface">{journal.operatorName} · {journal.operatorRole}</p>
                    <p className="text-[10.5px] text-body-sm text-on-surface-variant">Dibuat & diposting oleh operator terdaftar</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] text-label-sm text-on-surface-variant">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Immutable audit log · {shortNumber(journal.number)}@{journal.status.toLowerCase()}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
