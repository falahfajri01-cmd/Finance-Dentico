import { motion } from "framer-motion";
import { Search, ChevronDown, FilterX } from "lucide-react";
import { TABS, type TabKey } from "../data/coa";
import { cn } from "../utils/cn";

export type LevelFilter = "all" | "headers" | "details";
export type StatusFilter = "active" | "all" | "inactive";

interface FilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
  tabCounts: Record<TabKey, number>;
  level: LevelFilter;
  onLevelChange: (l: LevelFilter) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  onReset: () => void;
}

export default function FilterBar({
  query, onQueryChange, tab, onTabChange, tabCounts,
  level, onLevelChange, status, onStatusChange, onReset,
}: FilterBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}
      className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-soft"
    >
      {/* Search + selects */}
      <div className="flex flex-col items-center justify-between gap-space-md lg:flex-row">
        <div className="relative w-full lg:w-96">
          <Search size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari kode akun atau nama akun (contoh: 1103, Kas, Listrik)…"
            className="w-full rounded-lg border border-transparent bg-surface-container-low py-2.5 pl-10 pr-4 text-body-sm text-on-surface outline-none transition-all placeholder:text-outline hover:bg-surface-container-low/80 focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex w-full items-center gap-space-sm overflow-x-auto pb-1 scrollbar-none lg:w-auto lg:pb-0">
          <div className="relative min-w-[178px]">
            <select
              value={level}
              onChange={(e) => onLevelChange(e.target.value as LevelFilter)}
              className="w-full cursor-pointer rounded-lg border border-transparent bg-surface-container-low py-2.5 pl-3.5 pr-8 text-label-md text-on-surface outline-none transition-colors hover:bg-surface-container focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">Semua Level (Parent & Sub)</option>
              <option value="headers">Level 1 (Akun Header / Parent)</option>
              <option value="details">Level 2 (Akun Detail / Posting)</option>
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
          </div>
          <div className="relative min-w-[158px]">
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
              className="w-full cursor-pointer rounded-lg border border-transparent bg-surface-container-low py-2.5 pl-3.5 pr-8 text-label-md text-on-surface outline-none transition-colors hover:bg-surface-container focus:ring-2 focus:ring-primary/50"
            >
              <option value="active">Status: Aktif Saja</option>
              <option value="all">Status: Semua Status</option>
              <option value="inactive">Status: Nonaktif</option>
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
          </div>
          <button
            onClick={onReset}
            title="Reset Filter"
            className="shrink-0 rounded-lg bg-surface-container-low p-2.5 text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <FilterX size={19} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = tabCounts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-label-md transition-colors duration-200",
                active ? "text-on-primary" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {active && (
                <motion.span
                  layoutId="coa-tab-pill"
                  className="absolute inset-0 rounded-full bg-primary-container shadow-card"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              {!active && <span className="absolute inset-0 rounded-full bg-surface-container-low transition-colors hover:bg-surface-container" />}
              <span className="relative z-10">{t.label}</span>
              <span
                className={cn(
                  "relative z-10 rounded-full px-1.5 py-px text-[10px] font-bold tnum",
                  active ? "bg-white/20 text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
