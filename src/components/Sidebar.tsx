import { useState } from "react";
import {
  LayoutGrid, Network, Building2, Boxes, Users, Store, Settings,
  NotebookPen, Receipt, ShoppingBag, Wallet, SlidersHorizontal,
  BookOpenText, Scale, BadgeCheck, CalendarClock, TrendingUp,
  Landmark, Banknote, History, MapPin, Database, ChevronDown, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import { supabaseProjectRef, SUPABASE_TABLE } from "../lib/supabase";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Dashboard",
    items: [{ path: "overview-keuangan", label: "Overview Keuangan", icon: LayoutGrid }],
  },
  {
    title: "Master Data",
    items: [
      { path: "chart-of-accounts", label: "Chart of Accounts", icon: Network },
      { path: "branch-and-cabang", label: "Branch & Cabang", icon: Building2 },
      { path: "brand-management", label: "Brand", icon: Boxes },
      { path: "customer-pasien", label: "Customer / Pasien", icon: Users },
      { path: "vendor-management", label: "Vendor", icon: Store },
      { path: "accounting-settings", label: "Accounting Settings", icon: Settings },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { path: "jurnal-umum-and-entry", label: "Jurnal Umum & Entry", icon: NotebookPen },
      { path: "jurnal-penjualan", label: "Jurnal Penjualan", icon: Receipt },
      { path: "jurnal-pembelian", label: "Jurnal Pembelian", icon: ShoppingBag },
      { path: "kas-and-bank", label: "Kas & Bank", icon: Wallet },
      { path: "jurnal-penyesuaian", label: "Jurnal Penyesuaian", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Accounting & Control",
    items: [
      { path: "buku-besar", label: "Buku Besar", icon: BookOpenText },
      { path: "neraca-saldo", label: "Neraca Saldo", icon: Scale },
      { path: "rekonsiliasi-bank-and-qris", label: "Rekonsiliasi Bank & QRIS", icon: BadgeCheck },
      { path: "tutup-buku", label: "Tutup Buku", icon: CalendarClock },
    ],
  },
  {
    title: "Laporan Keuangan",
    items: [
      { path: "laba-rugi", label: "Laba Rugi", icon: TrendingUp },
      { path: "neraca", label: "Neraca", icon: Landmark },
      { path: "arus-kas", label: "Arus Kas", icon: Banknote },
      { path: "audit-trail-and-log", label: "Audit Trail & Log", icon: History },
    ],
  },
];

export function DenticoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[9px] bg-primary shadow-soft", className)}>
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="white" aria-hidden>
        <path d="M12 4c2.1 0 2.9.9 4.3.9 2.1 0 3.7 1.7 3.7 3.9 0 3.6-2 5.4-2.8 8.2-.2.9-.8 3.1-2.1 3.1-1 0-.9-1.8-1.3-3.6-.2-1-.7-1.8-1.8-1.8s-1.6.8-1.8 1.8c-.4 1.8-.3 3.6-1.3 3.6-1.3 0-1.9-2.2-2.1-3.1C6 14.2 4 12.4 4 8.8 4 6.6 5.6 4.9 7.7 4.9 9.1 4.9 9.9 4 12 4z" />
      </svg>
    </div>
  );
}

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string, label: string) => void;
  source: "supabase" | "demo";
  onClose?: () => void;
}

export default function Sidebar({ activePath, onNavigate, source, onClose }: SidebarProps) {
  const [entity, setEntity] = useState("Dentico Group (Consolidated)");
  const [branch, setBranch] = useState("Semua Cabang");

  return (
    <div className="flex h-full flex-col justify-between bg-surface-container-lowest">
      <div className="flex flex-col overflow-y-auto scrollbar-none">
        {/* Brand */}
        <div className="flex items-center justify-between px-space-md py-space-md">
          <div className="flex items-center gap-space-sm">
            <DenticoMark className="h-8 w-8" />
            <span className="text-headline-sm text-on-surface tracking-tight">Dentico</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-surface-container-high px-space-sm py-space-xs text-label-sm text-primary">
              v2.4 Core
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low lg:hidden"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Entity consolidation */}
        <div className="mb-space-sm flex flex-col gap-space-xs px-space-md">
          <div className="flex flex-col gap-space-xs rounded-xl border border-surface-container bg-surface-container-low p-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Konsolidasi Entitas
            </span>
            <div className="relative">
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-space-sm py-2 pr-7 text-label-md text-on-surface outline-none transition-shadow focus:ring-2 focus:ring-primary/60"
              >
                <option>Dentico Group (Consolidated)</option>
                <option>Brand A - Dental Care</option>
                <option>Brand B - Smile Clinic</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline" />
            </div>
            <div className="mt-space-xs flex items-center gap-space-xs">
              <MapPin size={16} className="shrink-0 text-primary" />
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full cursor-pointer bg-transparent text-body-sm text-on-surface-variant outline-none"
              >
                <option>Semua Cabang</option>
                <option>Yogyakarta</option>
                <option>Jakarta Selatan</option>
                <option>Surabaya</option>
              </select>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-space-xs px-space-md py-space-xs pb-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="pb-space-xs pt-space-sm first:pt-space-xs">
                <span className="px-space-sm text-label-sm uppercase tracking-wider text-outline">
                  {section.title}
                </span>
              </div>
              {section.items.map((item) => {
                const active = item.path === activePath;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path, item.label)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group mb-0.5 flex w-full items-center gap-space-sm rounded-lg px-space-sm py-2 text-left transition-all duration-150",
                      active
                        ? "bg-primary-container font-semibold text-on-primary-container shadow-card"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    )}
                  >
                    <Icon
                      size={19}
                      strokeWidth={active ? 2.2 : 1.9}
                      className={cn("shrink-0 transition-transform duration-150", !active && "group-hover:scale-110")}
                    />
                    <span className="text-label-md font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Sync footer */}
      <div className="p-space-md">
        <div className="flex items-center gap-space-sm rounded-xl border border-surface-container bg-surface-container-low p-space-sm">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-emerald-500" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-label-sm font-semibold text-on-surface">
              {source === "supabase" ? "Supabase Sinkron" : "Database Sinkron"}
            </span>
            <span className="truncate text-[10px] text-body-sm text-on-surface-variant">
              {source === "supabase" ? `Supabase · ${supabaseProjectRef || SUPABASE_TABLE}` : "Demo lokal · hubungkan Supabase"}
            </span>
          </div>
          <Database size={14} className="ml-auto shrink-0 text-outline" />
        </div>
      </div>
    </div>
  );
}
