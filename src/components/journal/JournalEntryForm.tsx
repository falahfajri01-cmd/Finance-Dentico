import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FilePlus2, Hash, CalendarDays, CirclePlus, Trash2, CheckCircle2,
  TriangleAlert, Send, BadgeCheck, Save, ArrowRight, X, ChevronDown,
  FileText, AlignLeft,
} from "lucide-react";
import { fmtRpFull } from "../../data/finance";
import {
  JOURNAL_TYPES, STATUS_ORDER,
  type Journal, type JournalLine, type JournalStatus, type JournalType,
} from "../../data/journal";
import type { CoaAccount } from "../../data/coa";
import { cn } from "../../utils/cn";
import { toISODate, today } from "../../utils/dateRange";
import type { PushToast } from "../Toasts";
import useScopeStore from "../../hooks/useScopeStore";

export interface JournalEntryFormProps {
  accounts: CoaAccount[];
  editing: Journal | null;
  number: string;
  onSave: (j: Journal, target: JournalStatus) => Promise<boolean>;
  onCancelEdit: () => void;
  pushToast: PushToast;
}

interface LineDraft {
  key: string;
  accountCode: string;
  memo: string;
  debit: string;
  credit: string;
}

let lineSeq = 0;
const newKey = () => `ln-${++lineSeq}`;

function defaultLines(accounts: CoaAccount[]): LineDraft[] {
  const has1103 = accounts.some((a) => a.code === "1103");
  const has4101 = accounts.some((a) => a.code === "4101");
  return [
    {
      key: newKey(),
      accountCode: has1103 ? "1103" : "",
      memo: "Penerimaan transfer QRIS pasien",
      debit: "1500000",
      credit: "0",
    },
    {
      key: newKey(),
      accountCode: has4101 ? "4101" : "",
      memo: "Pendapatan tindakan medis klinik",
      debit: "0",
      credit: "1500000",
    },
  ];
}

const fieldCls =
  "w-full bg-transparent px-space-md py-2 text-body-md text-on-surface outline-none placeholder:text-outline";
const boxCls =
  "flex items-center gap-space-xs rounded-lg border border-transparent bg-surface-container-low transition-all focus-within:border-primary/30 focus-within:bg-surface-container-lowest focus-within:shadow-card focus-within:ring-2 focus-within:ring-primary/40";

export default function JournalEntryForm({ accounts, editing, number, onSave, onCancelEdit, pushToast }: JournalEntryFormProps) {
  const [date, setDate] = useState(editing?.date ?? toISODate(today()));
  const [type, setType] = useState<JournalType>(editing?.type ?? "JP");
  const [brand, setBrand] = useState(editing?.brand ?? "Brand A");
  const [branch, setBranch] = useState(editing?.branch ?? "Yogyakarta - Gejayan");
  const [reference, setReference] = useState(editing?.reference ?? "INV-MED-2026-0000");
  const [description, setDescription] = useState(
    editing?.description ?? "Penerimaan pembayaran tindakan bleaching & penambalan pasien drg. Anisa"
  );
  const [lines, setLines] = useState<LineDraft[]>(() =>
    editing
      ? editing.lines.map((l) => ({ key: newKey(), accountCode: l.accountCode, memo: l.memo, debit: String(l.debit), credit: String(l.credit) }))
      : defaultLines(accounts)
  );
  const [saving, setSaving] = useState<JournalStatus | null>(null);
  const scope = useScopeStore();

  const totals = useMemo(() => {
    let d = 0, c = 0;
    for (const l of lines) {
      d += parseFloat(l.debit) || 0;
      c += parseFloat(l.credit) || 0;
    }
    return { debit: d, credit: c, diff: Math.abs(d - c), balanced: d > 0 && d === c, anyAmount: d > 0 || c > 0 };
  }, [lines]);

  const stage: JournalStatus = editing?.status ?? "DRAFT";

  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((ls) => [...ls, { key: newKey(), accountCode: "", memo: "", debit: "0", credit: "0" }]);

  const removeLine = (key: string) => {
    if (lines.length <= 2) {
      pushToast("error", "Minimal 2 baris", "Jurnal ganda memerlukan minimal 1 baris Debit & 1 baris Kredit.");
      return;
    }
    setLines((ls) => ls.filter((l) => l.key !== key));
  };

  const buildJournal = (): Journal | null => {
    const used = lines.filter((l) => l.accountCode);
    if (used.length < 2) {
      pushToast("error", "Akun belum lengkap", "Pilih akun COA untuk minimal 2 baris transaksi.");
      return null;
    }
    const acc = (code: string) => accounts.find((a) => a.code === code);
    const jl: JournalLine[] = used.map((l) => ({
      accountCode: l.accountCode,
      accountName: acc(l.accountCode)?.name ?? l.accountCode,
      memo: l.memo.trim(),
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
    }));
    return {
      id: editing?.id ?? `j-${Date.now().toString(36)}`,
      number,
      date,
      type,
      brand,
      branch,
      reference: reference.trim(),
      description: description.trim(),
      total: jl.reduce((s, l) => s + l.debit, 0),
      status: editing?.status ?? "DRAFT",
      operatorName: editing?.operatorName ?? "Nabila",
      operatorRole: editing?.operatorRole ?? "Finance Lead",
      operatorInitials: editing?.operatorInitials ?? "NB",
      lines: jl,
    };
  };

  const submit = async (target: JournalStatus) => {
    if (saving) return;
    if ((target === "REVIEW" || target === "POSTED") && !totals.balanced) {
      pushToast("error", "Jurnal tidak balance", `Selisih ${fmtRpFull(totals.diff)} — lengkapi baris sebelum ${target === "POSTED" ? "posting" : "ajukan review"}.`);
      return;
    }
    if (!totals.anyAmount) {
      pushToast("error", "Nominal kosong", "Isi minimal satu nominal Debit/Kredit.");
      return;
    }
    const j = buildJournal();
    if (!j) return;
    setSaving(target);
    const ok = await onSave({ ...j, status: target }, target);
    setSaving(null);
    if (ok) onCancelEdit();
  };

  const selectCls = cn(fieldCls, "cursor-pointer pr-7 text-label-md");
  const amountCls =
    "w-full rounded-lg bg-surface-container-lowest py-1.5 pl-8 pr-2.5 text-right text-num-table-md outline-none shadow-soft transition-shadow focus:ring-2 focus:ring-primary/50";

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }}
      className="relative flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-soft"
    >
      <div className="h-1.5 w-full bg-primary" />

      <div className="flex flex-col gap-space-lg p-space-lg">
        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container/10 text-primary">
              <FilePlus2 size={19} />
            </div>
            <div>
              <h2 className="text-headline-sm text-on-surface">
                {editing ? `Edit Jurnal ${number}` : "Input Jurnal Baru (Journal Entry Form)"}
              </h2>
              <span className="text-body-sm text-on-surface-variant">
                Masukkan entri ganda akuntansi dengan presisi real-time
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            {editing && (
              <button
                onClick={onCancelEdit}
                className="flex items-center gap-1 rounded-lg bg-surface-container-low px-2 py-1 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <X size={13} /> Batal edit
              </button>
            )}
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">No. Jurnal:</span>
            <div className="flex items-center gap-1 rounded-full bg-surface-container-high px-space-sm py-1 text-num-table-md font-bold text-primary">
              <Hash size={13} />
              <span>{number}</span>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm uppercase text-on-surface-variant">Tanggal Transaksi</label>
            <div className={boxCls}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(fieldCls, "cursor-pointer")} />
              <CalendarDays size={17} className="pointer-events-none mr-3 shrink-0 text-outline" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm uppercase text-on-surface-variant">Jenis Jurnal</label>
            <div className={cn(boxCls, "relative")}>
              <select value={type} onChange={(e) => setType(e.target.value as JournalType)} className={selectCls}>
                {JOURNAL_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 text-outline" />
            </div>
          </div>
            <div className="flex flex-col gap-1.5">
            <label className="text-label-sm uppercase text-on-surface-variant">Entitas Brand</label>
            <div className={cn(boxCls, "relative")}>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectCls}>
                {scope.jurnalBrandOpts.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 text-outline" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm uppercase text-on-surface-variant">Lokasi Cabang</label>
            <div className={cn(boxCls, "relative")}>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className={selectCls}>
                {scope.jurnalBranchOpts.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 text-outline" />
            </div>
          </div>
        </div>

        {/* Ref + description */}
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm uppercase text-on-surface-variant">Nomor Referensi (Dokumen Sumber)</label>
            <div className={boxCls}>
              <FileText size={17} className="ml-3 shrink-0 text-outline" />
              <input
                type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. INV-8812 / PO-441" className={cn(fieldCls, "pl-0")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-label-sm uppercase text-on-surface-variant">Deskripsi / Keterangan Transaksi</label>
            <div className={boxCls}>
              <AlignLeft size={17} className="ml-3 shrink-0 text-outline" />
              <input
                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Tuliskan keterangan detail transaksi..." className={cn(fieldCls, "pl-0")}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="flex flex-col gap-space-sm pt-space-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-space-xs">
              <span className="text-label-md text-on-surface">Rincian Baris Transaksi (Debit / Kredit)</span>
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-num-table-md text-primary">
                {lines.length} Baris
              </span>
            </div>
            <span className="text-body-sm text-on-surface-variant">Mata Uang: <strong className="text-on-surface">IDR (Rp)</strong></span>
          </div>

          <div className="overflow-x-auto rounded-xl bg-surface-container-low p-1">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="bg-surface-container-high/60 text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <th className="w-12 rounded-l-lg px-3 py-2.5 text-center">#</th>
                  <th className="w-72 px-3 py-2.5">Kode & Nama Akun</th>
                  <th className="px-3 py-2.5">Keterangan Baris</th>
                  <th className="w-44 px-3 py-2.5 text-right">Debit (IDR)</th>
                  <th className="w-44 px-3 py-2.5 text-right">Kredit (IDR)</th>
                  <th className="w-14 rounded-r-lg px-3 py-2.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-on-surface">
                {lines.map((l, i) => {
                  const dEmpty = !(parseFloat(l.debit) > 0);
                  const cEmpty = !(parseFloat(l.credit) > 0);
                  return (
                    <tr key={l.key} className="transition-colors hover:bg-surface-container-lowest">
                      <td className="px-3 py-2.5 text-center text-num-table-md text-outline">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-soft">
                          <select
                            value={l.accountCode}
                            onChange={(e) => setLine(l.key, { accountCode: e.target.value })}
                            className={cn(
                              "w-full cursor-pointer appearance-none bg-transparent px-2.5 py-1.5 pr-6 text-label-md outline-none",
                              l.accountCode ? "text-on-surface" : "text-outline"
                            )}
                          >
                            <option value="">— Pilih Akun COA —</option>
                            {accounts.map((a) => (
                              <option key={a.code} value={a.code}>[{a.code}] {a.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="pointer-events-none absolute right-2 text-outline" />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text" value={l.memo}
                          onChange={(e) => setLine(l.key, { memo: e.target.value })}
                          placeholder="Keterangan baris transaksi…"
                          className="w-full rounded-lg bg-surface-container-lowest px-2.5 py-1.5 text-body-sm text-on-surface shadow-soft outline-none transition-shadow placeholder:text-outline focus:ring-2 focus:ring-primary/50"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-[11px] font-semibold text-num-table-md text-outline">Rp</span>
                          <input
                            type="number" min={0} step={1000} value={l.debit}
                            onChange={(e) => setLine(l.key, { debit: e.target.value, credit: "0" })}
                            onFocus={(e) => e.target.select()}
                            className={cn(amountCls, dEmpty ? "text-on-surface-variant" : "font-bold text-on-surface")}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-[11px] font-semibold text-num-table-md text-outline">Rp</span>
                          <input
                            type="number" min={0} step={1000} value={l.credit}
                            onChange={(e) => setLine(l.key, { credit: e.target.value, debit: "0" })}
                            onFocus={(e) => e.target.select()}
                            className={cn(amountCls, cEmpty ? "text-on-surface-variant" : "font-bold text-on-surface")}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => removeLine(l.key)}
                          title="Hapus Baris"
                          className="rounded-lg p-1.5 text-outline transition-colors hover:bg-error-container/40 hover:text-error"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={addLine}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-container-high px-space-md py-2 text-label-md text-primary transition-all hover:bg-surface-container-highest active:scale-95"
            >
              <CirclePlus size={17} />
              <span>Tambah Baris Transaksi</span>
            </button>
            <span className="hidden text-body-sm text-on-surface-variant sm:inline">
              Tip: mengisi Debit otomatis mengosongkan Kredit pada baris yang sama (dan sebaliknya).
            </span>
          </div>
        </div>

        {/* Balance validator ribbon */}
        <div
          className={cn(
            "flex flex-col justify-between gap-space-md rounded-xl p-space-md transition-colors duration-300 md:flex-row md:items-center",
            totals.balanced ? "bg-emerald-500/[0.08]" : "bg-surface-container-high"
          )}
        >
          <div className="flex flex-wrap items-center gap-space-lg">
            <div className="flex flex-col">
              <span className="text-label-sm uppercase text-on-surface-variant">Total Debit</span>
              <span className="text-headline-md font-bold text-on-surface tnum">{fmtRpFull(totals.debit)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-label-sm uppercase text-on-surface-variant">Total Kredit</span>
              <span className="text-headline-md font-bold text-on-surface tnum">{fmtRpFull(totals.credit)}</span>
            </div>
            <div className="hidden h-8 w-px bg-outline-variant/60 md:block" />
            <div className="flex flex-col">
              <span className="text-label-sm uppercase text-on-surface-variant">Selisih (Variance)</span>
              <span className={cn("text-headline-md font-bold tnum", totals.balanced ? "text-emerald-600" : "text-error")}>
                {fmtRpFull(totals.diff)}
              </span>
            </div>
          </div>
          {totals.balanced ? (
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-space-md py-2 text-label-md text-emerald-800">
              <CheckCircle2 size={19} className="text-emerald-600" />
              <span className="font-semibold">BALANCED! Siap untuk diajukan review atau posting.</span>
            </div>
          ) : (
            <div className="flex animate-pulse items-center gap-2 rounded-full bg-error-container/80 px-space-md py-2 text-label-md text-on-error-container">
              <TriangleAlert size={19} className="text-error" />
              <span className="font-semibold">
                NOT BALANCED! Selisih {fmtRpFull(totals.diff)}. Jurnal tidak dapat diposting.
              </span>
            </div>
          )}
        </div>

        {/* Workflow + actions */}
        <div className="flex flex-col justify-between gap-space-md pt-space-xs lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Workflow:</span>
            <div className="flex items-center gap-1.5">
              {STATUS_ORDER.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight size={12} className="text-outline" />}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-label-sm",
                      s === stage
                        ? "flex items-center gap-1 bg-primary-container font-bold text-on-primary-container"
                        : "bg-surface-container-high text-on-surface-variant"
                    )}
                  >
                    {s === stage && <span className="h-1.5 w-1.5 rounded-full bg-surface-bright" />}
                    {s}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              onClick={() => submit("DRAFT")}
              disabled={!!saving}
              className="flex items-center gap-1.5 rounded-xl bg-surface-container px-space-md py-2.5 text-label-md text-on-surface transition-all hover:bg-surface-container-high active:scale-95 disabled:opacity-50"
            >
              <Save size={15} /> Simpan Draft
            </button>
            <button
              onClick={() => submit("REVIEW")}
              disabled={!!saving || !totals.balanced}
              className="flex items-center gap-1 rounded-xl bg-surface-container-high px-space-md py-2.5 text-label-md text-primary transition-all hover:bg-surface-container-highest active:scale-95 disabled:opacity-50"
              title={totals.balanced ? "Kirim ke Supervisor" : "Harus balance untuk diajukan"}
            >
              <Send size={14} /> Ajukan Review (Supervisor)
            </button>
            <button
              onClick={() => submit("POSTED")}
              disabled={!!saving || !totals.balanced}
              className="flex items-center gap-1.5 rounded-xl bg-primary-container px-space-lg py-2.5 text-label-md font-bold text-on-primary-container shadow-card transition-all hover:bg-primary hover:shadow-pop active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title={totals.balanced ? "Post ke General Ledger" : "Jurnal harus balance"}
            >
              <BadgeCheck size={17} />
              <span>{saving === "POSTED" ? "Memposting…" : "Post to General Ledger"}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
