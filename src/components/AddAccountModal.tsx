import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CirclePlus, X, ChevronsUpDown, Loader2, Info } from "lucide-react";
import {
  suggestNextCode, defaultNormalFor, type CoaAccount, type NormalBalance,
} from "../data/coa";
import { cn } from "../utils/cn";

export interface AddPayload {
  group: string;
  code: string;
  name: string;
  typeLabel: string;
  normal: NormalBalance;
  canPost: boolean;
}

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
  headers: CoaAccount[];
  accounts: CoaAccount[];
  presetGroup: string | null;
  onAdd: (p: AddPayload) => Promise<{ ok: boolean; error?: string }>;
}

const inputCls =
  "w-full rounded-lg border border-transparent bg-surface-container-low px-3 py-2.5 text-label-md text-on-surface outline-none transition-all focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/50";

export default function AddAccountModal({ open, onClose, headers, accounts, presetGroup, onAdd }: AddAccountModalProps) {
  const [group, setGroup] = useState(headers[0]?.code ?? "4000");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [typeLabel, setTypeLabel] = useState("");
  const [normal, setNormal] = useState<NormalBalance>("Kredit");
  const [canPost, setCanPost] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reset form whenever the modal opens */
  useEffect(() => {
    if (!open) return;
    const g = presetGroup && headers.some((h) => h.code === presetGroup) ? presetGroup : headers[0]?.code ?? "4000";
    setGroup(g);
    setCode(suggestNextCode(accounts, g));
    setNormal(defaultNormalFor(g));
    setName("");
    setTypeLabel("");
    setCanPost(true);
    setError(null);
    setSubmitting(false);
  }, [open, presetGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGroupChange = (g: string) => {
    setGroup(g);
    setCode(suggestNextCode(accounts, g));
    setNormal(defaultNormalFor(g));
  };

  const codeError = useMemo(() => {
    if (!code) return null;
    if (!/^\d{4}$/.test(code.trim())) return "Kode harus 4 digit angka.";
    if (accounts.some((a) => a.code === code.trim())) return `Kode ${code} sudah digunakan akun lain.`;
    return null;
  }, [code, accounts]);

  const valid = /^\d{4}$/.test(code.trim()) && !codeError && name.trim().length > 0;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await onAdd({
      group,
      code: code.trim(),
      name: name.trim(),
      typeLabel: typeLabel.trim() || "Akun Baru",
      normal,
      canPost,
    });
    setSubmitting(false);
    if (res.ok) onClose();
    else setError(res.error ?? "Gagal menambahkan akun.");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-inverse-surface/45 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface-container-lowest shadow-pop"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-container px-space-lg py-space-md">
              <div className="flex items-center gap-space-sm">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <CirclePlus size={19} />
                </span>
                <div>
                  <h3 className="text-headline-sm font-bold leading-tight text-on-surface">Tambah Akun Baru</h3>
                  <p className="text-[11.5px] text-body-sm text-on-surface-variant">Posting account (Level 2) pada struktur COA</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex max-h-[65vh] flex-col gap-space-sm overflow-y-auto px-space-lg py-space-md scrollbar-none">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-semibold text-on-surface-variant">Parent Account (Kelompok Induk)</label>
                <div className="relative">
                  <select value={group} onChange={(e) => handleGroupChange(e.target.value)} className={cn(inputCls, "cursor-pointer pr-8")}>
                    {headers.map((h) => (
                      <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                    ))}
                  </select>
                  <ChevronsUpDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-semibold text-on-surface-variant">Kode Akun</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                    placeholder="4105"
                    inputMode="numeric"
                    className={cn(inputCls, "text-num-table-md font-bold text-primary", codeError && "border-error/40 ring-2 ring-error/30")}
                  />
                  {codeError
                    ? <span className="text-[10.5px] font-medium text-error">{codeError}</span>
                    : <span className="text-[10.5px] text-body-sm text-outline">Diusulkan otomatis: kode kosong berikutnya</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-semibold text-on-surface-variant">Normal Balance</label>
                  <div className="relative">
                    <select value={normal} onChange={(e) => setNormal(e.target.value as NormalBalance)} className={cn(inputCls, "cursor-pointer pr-8 font-bold text-secondary")}>
                      <option value="Kredit">Kredit (CR)</option>
                      <option value="Debit">Debit (DR)</option>
                    </select>
                    <ChevronsUpDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-semibold text-on-surface-variant">Nama Akun (Resmi)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth. Pendapatan Voucher & Membership"
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kategori / Tipe Akun</label>
                <input
                  value={typeLabel}
                  onChange={(e) => setTypeLabel(e.target.value)}
                  placeholder="cth. Pendapatan, Aset Lancar, Biaya Operasional"
                  className={inputCls}
                />
              </div>

              {/* Posting switch */}
              <div className="mt-1 flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
                <div className="flex flex-col">
                  <span className="text-label-md font-semibold text-on-surface">Akun Posting (Level 2)</span>
                  <span className="text-[11px] text-body-sm text-on-surface-variant">Dapat dipilih saat input jurnal</span>
                </div>
                <button
                  role="switch"
                  aria-checked={canPost}
                  onClick={() => setCanPost((v) => !v)}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", canPost ? "bg-primary-container" : "bg-surface-container-highest")}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 550, damping: 32 }}
                    className={cn("absolute top-[2px] h-5 w-5 rounded-full bg-white shadow", canPost ? "right-[2px]" : "left-[2px]")}
                  />
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-surface-container-high/50 p-space-sm">
                <Info size={15} className="mt-0.5 shrink-0 text-outline" />
                <p className="text-[11px] leading-relaxed text-body-sm text-on-surface-variant">
                  Setelah menerima transaksi pertama, akun otomatis <span className="font-semibold text-on-surface">terkunci</span> (Audit Safe Lock) dan hanya bisa dinonaktifkan — tidak dihapus.
                </p>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-error-container px-3 py-2 text-[12px] font-medium text-on-error-container">
                  {error}
                </motion.p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-surface-container bg-surface-container-low/60 px-space-lg py-space-md">
              <button
                onClick={onClose}
                className="rounded-lg bg-surface-container-highest px-4 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Batal
              </button>
              <button
                onClick={submit}
                disabled={!valid || submitting}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-label-md transition-all active:scale-[0.98]",
                  valid && !submitting
                    ? "bg-primary-container text-on-primary shadow-card hover:bg-secondary"
                    : "cursor-not-allowed bg-surface-container-highest text-on-surface-variant"
                )}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CirclePlus size={16} />}
                {submitting ? "Menyimpan…" : "Tambah Akun"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
