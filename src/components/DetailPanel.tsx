import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ScrollText, ShieldCheck, Shield, Info, Save, BookOpenText, Lightbulb,
  ChevronsUpDown, Loader2, CircleCheck,
} from "lucide-react";
import { fmtCount, type CoaAccount, type NormalBalance } from "../data/coa";
import { cn } from "../utils/cn";

interface DetailPanelProps {
  account: CoaAccount | null;
  headers: CoaAccount[];
  onSave: (id: string, patch: Partial<CoaAccount>) => Promise<boolean>;
  onToggleStatus: (a: CoaAccount, next: boolean) => void;
  onOpenLedger: (a: CoaAccount) => void;
}

const inputCls =
  "w-full rounded-lg border border-transparent bg-surface-container-low px-3 py-2 text-label-md text-on-surface outline-none transition-all focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/50";

export default function DetailPanel({ account, headers, onSave, onToggleStatus, onOpenLedger }: DetailPanelProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [typeLabel, setTypeLabel] = useState("");
  const [normal, setNormal] = useState<NormalBalance>("Kredit");
  const [group, setGroup] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Sync local form whenever the selected account changes */
  useEffect(() => {
    if (!account) return;
    setCode(account.code);
    setName(account.name);
    setTypeLabel(account.typeLabel);
    setNormal(account.normal);
    setGroup(account.group);
    setError(null);
  }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!account) return false;
    return (
      code !== account.code || name !== account.name || typeLabel !== account.typeLabel ||
      normal !== account.normal || group !== account.group
    );
  }, [account, code, name, typeLabel, normal, group]);

  if (!account) {
    return (
      <div className="flex flex-col gap-space-md xl:sticky xl:top-20">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-lowest p-space-lg text-center shadow-card">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScrollText size={22} />
          </span>
          <p className="text-body-sm text-on-surface-variant">Pilih akun pada tabel untuk melihat detail master.</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!/^\d{4}$/.test(code.trim())) {
      setError("Kode akun harus 4 digit angka (contoh: 4105).");
      return;
    }
    if (!name.trim()) {
      setError("Nama akun tidak boleh kosong.");
      return;
    }
    setError(null);
    setSaving(true);
    const header = headers.find((h) => h.code === group);
    const ok = await onSave(account.id, {
      code: code.trim(),
      name: name.trim(),
      typeLabel: typeLabel.trim() || account.typeLabel,
      normal,
      group,
      parentCode: account.isHeader ? null : group,
      parentLabel: account.isHeader ? null : header ? `${header.code} - ${header.name}` : account.parentLabel,
      isLocked: account.isLocked || account.txCount > 0,
    });
    setSaving(false);
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const headerName = headers.find((h) => h.code === group)?.name ?? "";

  return (
    <div className="flex flex-col gap-space-md xl:sticky xl:top-20">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="relative flex flex-col gap-space-md overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-card"
      >
        {/* Accent bar */}
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-primary" />

        {/* Title */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
              <ScrollText size={19} />
            </span>
            <div className="min-w-0">
              <span className="text-label-sm uppercase tracking-wider text-outline">Detail Akun Master</span>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={account.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="truncate text-headline-sm font-bold leading-tight text-on-surface"
                >
                  {account.code} - {account.name}
                </motion.h2>
              </AnimatePresence>
            </div>
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] text-label-sm font-bold",
            account.isActive ? "bg-emerald-500/10 text-emerald-700" : "bg-surface-container-highest text-on-surface-variant"
          )}>
            {account.isActive ? "Terverifikasi" : "Nonaktif"}
          </span>
        </div>

        {/* Protection banner */}
        {account.isLocked ? (
          <div className="flex items-start gap-space-sm rounded-xl border border-amber-200/60 bg-amber-50 p-space-sm text-amber-900">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex flex-col text-[12px] leading-relaxed">
              <span className="font-semibold text-amber-950">Proteksi Keamanan Integritas GL Aktif</span>
              <span className="text-amber-800">
                Akun ini memiliki <strong className="font-bold tnum">{fmtCount(account.txCount)} transaksi</strong> jurnal
                terhubung. Tombol &lsquo;Hapus Akun&rsquo; telah dikunci permanen oleh sistem.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-space-sm rounded-xl border border-emerald-200/70 bg-emerald-50 p-space-sm text-emerald-900">
            <Shield size={19} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="flex flex-col text-[12px] leading-relaxed">
              <span className="font-semibold text-emerald-950">Belum Ada Riwayat Transaksi</span>
              <span className="text-emerald-800">
                Akun masih bersih — aman untuk restrukturisasi kode maupun relokasi parent.
              </span>
            </div>
          </div>
        )}

        {/* Fields */}
        <div className="flex flex-col gap-space-sm text-on-surface">
          <div className="grid grid-cols-2 gap-space-sm">
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-semibold text-on-surface-variant">Kode Akun</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={cn(inputCls, "text-num-table-md font-bold text-primary")}
                maxLength={6}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-semibold text-on-surface-variant">Normal Balance</label>
              <div className="relative">
                <select
                  value={normal}
                  onChange={(e) => setNormal(e.target.value as NormalBalance)}
                  className={cn(inputCls, "cursor-pointer pr-8 font-bold text-secondary")}
                >
                  <option value="Kredit">Kredit (CR)</option>
                  <option value="Debit">Debit (DR)</option>
                </select>
                <ChevronsUpDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-semibold text-on-surface-variant">Nama Akun (Resmi)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-semibold text-on-surface-variant">Kategori / Tipe Akun</label>
            <input value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-semibold text-on-surface-variant">Parent Account (Kelompok)</label>
            <div className="relative">
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                disabled={account.isHeader}
                className={cn(inputCls, "cursor-pointer pr-8 text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-70")}
              >
                {headers.map((h) => (
                  <option key={h.code} value={h.code}>
                    {h.code} - {h.name}
                  </option>
                ))}
              </select>
              <ChevronsUpDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
            </div>
            {!account.isHeader && headerName && (
              <span className="text-[10.5px] text-body-sm text-outline">Kelompok induk: {group} · {headerName}</span>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-error-container px-3 py-2 text-[12px] font-medium text-on-error-container"
            >
              {error}
            </motion.p>
          )}

          {/* Status toggle */}
          <div className="mt-1 flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
            <div className="flex flex-col">
              <span className="text-label-md font-semibold text-on-surface">Status Akun Aktif</span>
              <span className="text-[11px] text-body-sm text-on-surface-variant">
                {account.isActive ? "Siap digunakan pada modul jurnal" : "Disembunyikan dari pilihan jurnal"}
              </span>
            </div>
            <button
              role="switch"
              aria-checked={account.isActive}
              onClick={() => onToggleStatus(account, !account.isActive)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                account.isActive ? "bg-primary-container" : "bg-surface-container-highest"
              )}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 550, damping: 32 }}
                className={cn(
                  "absolute top-[2px] h-5 w-5 rounded-full bg-white shadow",
                  account.isActive ? "right-[2px]" : "left-[2px]"
                )}
              />
            </button>
          </div>

          {/* Compliance note */}
          <div className="flex items-start gap-2 rounded-lg bg-surface-container-high/50 p-space-sm">
            <Info size={15} className="mt-0.5 shrink-0 text-outline" />
            <p className="text-[11px] leading-relaxed text-body-sm text-on-surface-variant">
              Catatan: Gunakan <span className="font-semibold text-on-surface">Active / Inactive</span>, bukan Delete
              untuk menjaga integritas General Ledger (GL) dan riwayat audit Dentico.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-label-md shadow transition-all active:scale-[0.99]",
              dirty && !saving
                ? "bg-primary-container text-on-primary shadow-card hover:bg-secondary"
                : "cursor-not-allowed bg-surface-container-highest text-on-surface-variant shadow-none"
            )}
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : savedFlash ? <CircleCheck size={17} /> : <Save size={17} />}
            <span>{saving ? "Menyimpan…" : savedFlash ? "Perubahan Tersimpan" : "Simpan Perubahan"}</span>
          </button>
          <button
            onClick={() => onOpenLedger(account)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container-low py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <BookOpenText size={17} className="text-secondary" />
            <span>Lihat Buku Besar Akun Ini</span>
          </button>
        </div>
      </motion.div>

      {/* Quick tips */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-soft"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-label-md font-semibold text-on-surface">Tips Integrasi Jurnal</span>
          <span className="text-[12px] text-body-sm text-on-surface-variant">
            Semua akun tipe posting (Level 2) otomatis sinkron ke modul POS Kasir Klinik & Pembelian Farmasi.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
