import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Boxes, Store, CalendarClock } from "lucide-react";

import JournalEntryForm from "./JournalEntryForm";
import JournalRegistry, { type RegistryFilter } from "./JournalRegistry";
import JournalDetailModal from "./JournalDetailModal";

import { fetchAccounts } from "../../data/coaRepository";
import {
  saveJournal, deleteJournal, updateStatus,
} from "../../data/journalRepository";
import {
  getJournals, initJournalStore, refreshJournals, subscribeJournals,
} from "../../data/journalStore";
import {
  isBalanced, nextNumber, shortNumber, sortJournals,
  type Journal, type JournalStatus,
} from "../../data/journal";
import type { CoaAccount } from "../../data/coa";
import type { PushToast } from "../Toasts";

interface JournalPageProps {
  pushToast: PushToast;
  /** external signal: jump to a registry status filter (from Overview) */
  statusDrill: { status: RegistryFilter | null; n: number };
}

export default function JournalPage({ pushToast, statusDrill }: JournalPageProps) {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Journal | null>(null);
  const [viewing, setViewing] = useState<Journal | null>(null);
  const [filter, setFilter] = useState<RegistryFilter>("ALL");
  const [formNonce, setFormNonce] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  /* ── Load accounts + subscribe to the shared journal store ────── */
  useEffect(() => {
    initJournalStore();
    let alive = true;
    (async () => {
      const accRes = await fetchAccounts();
      if (!alive) return;
      setAccounts(accRes.data.filter((a) => !a.isHeader && a.canPost));
      await refreshJournals();
      if (!alive) return;
      setLoading(false);
    })();
    const unsub = subscribeJournals(() => setJournals(getJournals()));
    setJournals(getJournals());
    return () => { alive = false; unsub(); };
  }, []);

  /* ── External status drill (Overview → Review queue) ──────────── */
  useEffect(() => {
    if (statusDrill.n > 0 && statusDrill.status) setFilter(statusDrill.status);
  }, [statusDrill]);

  const postingAccounts = useMemo(() => accounts.filter((a) => a.isActive !== false), [accounts]);

  /** Number shown in the form header: keep when editing, else next free */
  const formNumber = useMemo(
    () => (editing ? editing.number : nextNumber(journals)),
    [editing, journals]
  );

  const scrollToForm = () =>
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ── Save (draft / review / posted / edit) ────────────────────── */
  const handleSave = useCallback(
    async (journal: Journal, target: JournalStatus): Promise<boolean> => {
      try {
        await saveJournal(journal, journals);
        setJournals((prev) =>
          (prev.some((x) => x.id === journal.id)
            ? prev.map((x) => (x.id === journal.id ? journal : x))
            : [journal, ...prev]
          ).sort(sortJournals)
        );
        setFormNonce((n) => n + 1);
        const short = shortNumber(journal.number);
        if (target === "DRAFT") pushToast("success", `Draft ${short} tersimpan`, "Jurnal tersimpan sebagai draft kerja.");
        else if (target === "REVIEW") pushToast("success", `${short} diajukan review`, "Menunggu approval Supervisor keuangan.");
        else pushToast("success", `${short} diposting ke GL`, "Saldo buku besar diperbarui otomatis.");
        return true;
      } catch (e) {
        pushToast("error", "Gagal menyimpan jurnal", e instanceof Error ? e.message : "Kesalahan tak dikenal.");
        return false;
      }
    },
    [journals, pushToast]
  );

  /* ── Registry actions ─────────────────────────────────────────── */
  const handleEdit = (j: Journal) => {
    setEditing(j);
    scrollToForm();
  };

  const handleApprove = async (j: Journal) => {
    if (!isBalanced(j.lines)) {
      pushToast("error", "Tidak dapat approve", `${shortNumber(j.number)} tidak balance.`);
      return;
    }
    const updated = await updateStatus(j.id, "APPROVED", journals);
    if (updated) {
      setJournals((prev) => prev.map((x) => (x.id === j.id ? updated : x)).sort(sortJournals));
      pushToast("success", `${shortNumber(j.number)} disetujui`, "Status APPROVED — siap diposting ke GL.");
    }
  };

  const handleReject = async (j: Journal) => {
    const updated = await updateStatus(j.id, "DRAFT", journals);
    if (updated) {
      setJournals((prev) => prev.map((x) => (x.id === j.id ? updated : x)).sort(sortJournals));
      pushToast("info", `${shortNumber(j.number)} dikembalikan`, "Jurnal ditolak dan kembali menjadi DRAFT.");
    }
  };

  const handlePost = async (j: Journal) => {
    const updated = await updateStatus(j.id, "POSTED", journals);
    if (updated) {
      setJournals((prev) => prev.map((x) => (x.id === j.id ? updated : x)).sort(sortJournals));
      pushToast("success", `${shortNumber(j.number)} diposting ke GL`, "Saldo buku besar diperbarui otomatis.");
    }
  };

  const handleDelete = async (j: Journal) => {
    const next = await deleteJournal(j.id, journals);
    setJournals(next);
    if (editing?.id === j.id) setEditing(null);
    pushToast("info", `Draft ${shortNumber(j.number)} dihapus`, "Hanya draft yang dapat dihapus permanen.");
  };

  return (
    <div className="relative flex w-full flex-col gap-space-lg">
      {/* Glow */}
      <div className="pointer-events-none absolute -top-8 right-1/4 -z-10 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl" aria-hidden />

      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col gap-space-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <nav className="flex items-center gap-space-xs text-label-sm text-on-surface-variant">
            <span>Transaksi</span>
            <ChevronRight size={13} className="text-outline" />
            <span className="font-semibold text-primary">Jurnal Umum & Entry</span>
          </nav>
          <div className="flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-sm py-1 text-label-sm text-on-surface">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary-container" />
            <span className="text-on-surface-variant">Dual-Entry Engine:</span>
            <span className="font-semibold text-primary">Active & Balanced</span>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-end">
          <div>
            <h1 className="text-headline-xl tracking-tight text-on-surface">Jurnal Umum & Transaksi</h1>
            <p className="mt-0.5 text-body-md text-on-surface-variant">
              Pusat pencatatan transaksi terintegrasi dengan validasi balance otomatis (Total Debit = Total Kredit).
            </p>
          </div>
          {/* Scope strip */}
          <div className="flex flex-wrap items-center gap-space-xs rounded-xl bg-surface-container-lowest p-1.5 text-label-md text-on-surface shadow-soft">
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-container-low px-space-sm py-1">
              <Boxes size={15} className="text-primary" />
              <span className="text-[11px] text-label-sm text-on-surface-variant">Brand:</span>
              <span className="font-semibold">Dentico Group (All)</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-container-low px-space-sm py-1">
              <Store size={15} className="text-primary" />
              <span className="text-[11px] text-label-sm text-on-surface-variant">Cabang:</span>
              <span className="font-semibold">Semua Cabang</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-space-sm py-1">
              <CalendarClock size={15} className="text-on-surface-variant" />
              <span className="font-semibold text-primary">September 2026</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Entry form */}
      <div ref={formRef} className="scroll-mt-24">
        {loading ? (
          <div className="flex h-80 flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-soft">
            <div className="h-6 w-64 animate-pulse rounded bg-surface-container-high" />
            <div className="grid grid-cols-4 gap-space-md">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-container-high" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
            <div className="h-32 animate-pulse rounded-xl bg-surface-container-high" />
            <div className="h-16 animate-pulse rounded-xl bg-surface-container-high" />
          </div>
        ) : (
          <JournalEntryForm
            key={`${editing?.id ?? "new"}-${formNonce}`}
            accounts={postingAccounts}
            editing={editing}
            number={formNumber}
            onSave={handleSave}
            onCancelEdit={() => setEditing(null)}
            pushToast={pushToast}
          />
        )}
      </div>

      {/* Registry */}
      {loading ? (
        <div className="flex h-96 flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-soft">
          <div className="h-6 w-72 animate-pulse rounded bg-surface-container-high" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-container-high" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      ) : (
        <JournalRegistry
          journals={journals}
          filter={filter}
          onFilterChange={setFilter}
          onView={setViewing}
          onEdit={handleEdit}
          onApprove={handleApprove}
          onReject={handleReject}
          onPost={handlePost}
          onDelete={handleDelete}
          pushToast={pushToast}
        />
      )}

      {/* Footnote */}
      <div className="flex items-center justify-between border-t border-surface-container pt-space-md text-[11px] text-body-sm text-outline">
        <span>Dentico Finance Core v2.4 · Jurnal Umum & Entry · Dual-Entry Validated</span>
        <span>{journals.length} jurnal di registry lokal</span>
      </div>

      <JournalDetailModal journal={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
