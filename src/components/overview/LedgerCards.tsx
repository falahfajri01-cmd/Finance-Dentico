import { motion } from "framer-motion";
import {
  ArrowRight, ShieldCheck, Lock, ClipboardCheck, SquarePen, CloudDownload,
  BookOpenText, CalendarClock,
} from "lucide-react";
import { fmtRpFull, type FinanceMeta } from "../../data/finance";
import { cn } from "../../utils/cn";
import type { PushToast } from "../Toasts";

import type { TopExpense } from "../../data/finance";

interface LedgerCardsProps {
  meta: FinanceMeta;
  topExpenses: TopExpense[];
  /** Label periode aktif, mis. "Oktober 2026" — mengikuti filter utama. */
  periodLabel?: string;
  pushToast: PushToast;
  onDrillCoa: (code: string) => void;
  onOpenJournal: (status?: "ALL" | "DRAFT" | "REVIEW" | "APPROVED" | "POSTED" | "LOCKED") => void;
  onOpenLedger: () => void;
}

const cardCls = "flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg shadow-soft";
const rise = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function LedgerCards({ meta, topExpenses, pushToast, onDrillCoa, onOpenJournal, onOpenLedger, periodLabel }: LedgerCardsProps) {
  const p = meta.pipeline;

  const shortcuts: { label: string; desc: string; Icon: typeof SquarePen; fg: string; onClick: () => void }[] = [
    { label: "Jurnal Umum", desc: "Input manual debit/kredit", Icon: SquarePen, fg: "text-primary", onClick: () => onOpenJournal() },
    { label: "Import POS", desc: "Tarik invoice kasir", Icon: CloudDownload, fg: "text-secondary", onClick: () => pushToast("info", "Import POS · roadmap", "Sinkronisasi POS Kasir Klinik tersedia di rilis berikutnya.") },
    { label: "Buku Besar", desc: "Audit trail & drill-down", Icon: BookOpenText, fg: "text-primary", onClick: () => onOpenLedger() },
    { label: "Pra-Tutup Buku", desc: "Validasi balance final", Icon: CalendarClock, fg: "text-on-surface", onClick: () => pushToast("info", "Pra-Tutup Buku · roadmap", "Modul Tutup Buku tersedia di rilis berikutnya.") },
  ];

  return (
    <section className="grid grid-cols-1 gap-space-md lg:grid-cols-3">
      {/* Card 1: Top 5 expenses — drill down to COA */}
      <motion.div {...rise} transition={{ duration: 0.4, delay: 0.24 }} className={cardCls}>
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-md text-on-surface">Top 5 Beban Operasional</h3>
            <span className="rounded bg-surface-container-low px-space-xs py-0.5 text-label-sm text-on-surface-variant">{periodLabel ?? "—"}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Postingan COA biaya terbesar bulan berjalan — klik baris untuk drill-down ke COA
          </p>
          <div className="mt-space-sm flex flex-col gap-space-xs">
            {topExpenses.length === 0 ? (
              <div className="rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">Belum ada biaya operasional pada filter ini.</div>
            ) : topExpenses.map((e, i) => {
              const max = topExpenses[0].amount;
              return (
                <button
                  key={e.code}
                  onClick={() => onDrillCoa(e.code)}
                  className="group relative flex items-center justify-between overflow-hidden rounded-xl p-space-xs text-left transition-colors hover:bg-surface-container-low"
                >
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-xl bg-primary/[0.05]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(e.amount / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.35 + i * 0.07, ease: "easeOut" }}
                  />
                  <span className="relative flex min-w-0 items-center gap-space-xs">
                    <span className="rounded bg-surface-container px-space-xs py-0.5 font-mono text-[10px] text-label-sm text-on-surface-variant transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      {e.code}
                    </span>
                    <span className="truncate text-body-md text-on-surface">{e.name}</span>
                  </span>
                  <span className="relative shrink-0 text-num-table-md font-bold text-on-surface">
                    {fmtRpFull(e.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => onDrillCoa("6")}
          className="mt-space-md inline-flex items-center gap-1 self-start pt-space-xs text-label-md text-primary transition-opacity hover:opacity-70"
        >
          <span>Lihat Detail di Chart of Accounts</span>
          <ArrowRight size={15} />
        </button>
      </motion.div>

      {/* Card 2: Transaction pipeline */}
      <motion.div {...rise} transition={{ duration: 0.4, delay: 0.3 }} className={cardCls}>
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-md text-on-surface">Status Alur Transaksi</h3>
            <ShieldCheck size={19} className="text-outline" />
          </div>
          <p className="text-body-sm text-on-surface-variant">Integritas kontrol jurnal & rekonsiliasi</p>
          <div className="mt-space-sm flex flex-col gap-space-xs">
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low/60 p-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="h-2 w-2 rounded-full bg-outline" />
                <span className="text-body-md text-on-surface">Jurnal Draft</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="font-mono text-label-sm text-on-surface-variant tnum">{fmtRpFull(p.draftAmount)}</span>
                <span className="rounded-full bg-surface-container px-space-xs py-0.5 text-[11px] text-label-sm font-bold text-on-surface">{p.draftCount} trx</span>
              </div>
            </div>
            <button
              onClick={() => onOpenJournal("REVIEW")}
              className="flex w-full items-center justify-between rounded-xl bg-surface-container-highest/50 p-space-xs text-left transition-colors hover:bg-surface-container-highest/80"
            >
              <div className="flex items-center gap-space-xs">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary" />
                <span className="text-body-md font-medium text-on-surface">Jurnal Butuh Approval</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="font-mono text-label-sm text-on-surface-variant tnum">{fmtRpFull(p.reviewAmount)}</span>
                <span className="rounded-full bg-primary-container px-space-xs py-0.5 text-[11px] text-label-sm font-bold text-on-primary-container">{p.reviewCount} review</span>
              </div>
            </button>
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low/60 p-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-body-md font-medium text-on-surface">Jurnal Posted (Masuk GL)</span>
              </div>
              <span className="rounded-full bg-surface-container-highest px-space-xs py-0.5 text-[11px] text-label-sm font-bold text-primary">{p.postedCount} posted</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low/60 p-space-xs">
              <div className="flex items-center gap-space-xs">
                <Lock size={15} className="text-outline" />
                <span className="text-body-md text-on-surface">Periode {p.lockedPeriod}</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-surface-container px-space-xs py-0.5 text-[11px] font-semibold uppercase tracking-wider text-label-sm text-outline">
                <Lock size={10} /> Locked
              </span>
            </div>
          </div>
        </div>
        <div className="mt-space-md flex items-center justify-between rounded-xl bg-surface-container-low p-space-xs">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck size={17} className="text-primary" />
            <span className="text-label-sm text-on-surface">Bank & QRIS Recon</span>
          </div>
          <span className="text-label-sm font-bold text-primary">{p.reconMatchedPct}% Matched (Diff {fmtRpFull(p.reconDiffAmount)})</span>
        </div>
      </motion.div>

      {/* Card 3: Shortcuts */}
      <motion.div {...rise} transition={{ duration: 0.4, delay: 0.36 }} className={cardCls}>
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-md text-on-surface">Aksi & Pintasan Cepat</h3>
            <span className="rounded bg-surface-container-high px-space-xs py-0.5 text-[11px] text-label-sm font-bold text-primary">Shortcuts</span>
          </div>
          <p className="text-body-sm text-on-surface-variant">Akses instan modul akuntansi klinis operasional</p>
          <div className="mt-space-sm grid grid-cols-2 gap-space-sm">
            {shortcuts.map(({ label, desc, Icon, fg, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="group flex flex-col items-start gap-space-xs rounded-xl bg-surface-container-low p-space-sm text-left transition-all hover:bg-surface-container active:scale-[0.98]"
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-lowest shadow-soft transition-transform group-hover:scale-105", fg)}>
                  <Icon size={17} />
                </div>
                <span className="mt-1 text-label-md text-on-surface">{label}</span>
                <span className="text-[11px] text-body-sm text-on-surface-variant">{desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-space-md flex items-center justify-between pt-space-xs text-[11px] text-body-sm text-outline">
          <span>Pencarian global:</span>
          <kbd className="rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-on-surface-variant">⌘ K · lalu ketik akun/jurnal</kbd>
        </div>
      </motion.div>
    </section>
  );
}
