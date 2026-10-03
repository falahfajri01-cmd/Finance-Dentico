import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, Bell, ChevronDown, Menu, CheckCircle2, QrCode, CalendarClock,
  UserRound, SlidersHorizontal, LogOut, Check,
} from "lucide-react";
import { cn } from "../utils/cn";

interface Notif {
  id: number;
  icon: "journal" | "qris" | "close";
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

const INITIAL_NOTIFS: Notif[] = [
  { id: 1, icon: "journal", title: "Jurnal JV-0926-1187 menunggu approval", desc: "Beban jasa medis drg. Ratna · Rp 8.450.000", time: "12 mnt lalu", unread: true },
  { id: 2, icon: "qris", title: "Rekonsiliasi QRIS BSI selesai", desc: "214 transaksi cocok · 2 perlu review manual", time: "1 jam lalu", unread: true },
  { id: 3, icon: "close", title: "Reminder tutup buku September", desc: "Periode ditutup otomatis dalam 4 hari", time: "3 jam lalu", unread: true },
];

const NOTIF_STYLE = {
  journal: { bg: "bg-primary/10", fg: "text-primary", Icon: CheckCircle2 },
  qris: { bg: "bg-emerald-500/10", fg: "text-emerald-600", Icon: QrCode },
  close: { bg: "bg-amber-500/10", fg: "text-amber-600", Icon: CalendarClock },
};

interface TopbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenMobileNav: () => void;
  onAction: (label: string) => void;
}

export default function Topbar({ query, onQueryChange, onOpenMobileNav, onAction }: TopbarProps) {
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const unread = notifs.filter((n) => n.unread).length;

  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between gap-space-md border-b border-surface-container bg-surface-container-lowest/85 px-space-md backdrop-blur-xl lg:left-72 lg:px-space-lg">
      {/* Left: hamburger + command search */}
      <div className="flex min-w-0 flex-1 items-center gap-space-sm">
        <button
          onClick={onOpenMobileNav}
          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low lg:hidden"
          aria-label="Buka menu"
        >
          <Menu size={20} />
        </button>
        <div className="group flex w-full max-w-md items-center gap-space-sm rounded-xl border border-transparent bg-surface-container-low px-space-md py-space-xs text-on-surface-variant transition-all focus-within:border-primary/30 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/50">
          <Search size={17} className="shrink-0 text-outline transition-colors group-focus-within:text-primary" />
          <input
            id="global-search"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari nomor jurnal, akun COA, atau transaksi…"
            className="w-full bg-transparent text-body-sm text-on-surface outline-none placeholder:text-outline"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded bg-surface-container-highest px-space-xs py-0.5 text-[10px] font-semibold text-on-surface-variant sm:flex">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-space-sm md:gap-space-md">
        <div className="hidden items-center gap-space-xs rounded-full bg-surface-container-low px-space-sm py-1.5 text-label-sm text-on-surface md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Periode: September 2026</span>
          <span className="text-outline-variant">•</span>
          <span className="font-bold text-primary">OPEN</span>
        </div>

        {/* Notifications */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((v) => !v)}
            className={cn(
              "relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low",
              bellOpen && "bg-surface-container-low text-on-surface"
            )}
            aria-label="Notifikasi"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error">
                {unread}
              </span>
            )}
          </button>
          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute right-0 top-12 w-[21rem] overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest shadow-pop"
              >
                <div className="flex items-center justify-between border-b border-surface-container px-space-md py-3">
                  <span className="text-label-md text-on-surface">Notifikasi</span>
                  <button
                    onClick={() => setNotifs((ns) => ns.map((n) => ({ ...n, unread: false })))}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary transition-opacity hover:opacity-70"
                  >
                    <Check size={12} /> Tandai dibaca
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-none">
                  {notifs.map((n) => {
                    const { bg, fg, Icon } = NOTIF_STYLE[n.icon];
                    return (
                      <button
                        key={n.id}
                        onClick={() => setNotifs((ns) => ns.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}
                        className="flex w-full items-start gap-3 border-b border-surface-container-low px-space-md py-3 text-left transition-colors last:border-0 hover:bg-surface-container-low/60"
                      >
                        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", bg, fg)}>
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold leading-snug text-on-surface">{n.title}</span>
                          <span className="block truncate text-[11.5px] text-on-surface-variant">{n.desc}</span>
                          <span className="mt-0.5 block text-[10.5px] text-outline">{n.time}</span>
                        </span>
                        {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-container" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden h-6 w-px bg-surface-container-high sm:block" />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-space-sm rounded-lg p-1 pr-1.5 transition-colors hover:bg-surface-container-low"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-bold tracking-tight text-on-primary">
              NF
            </span>
            <span className="hidden flex-col text-left xl:flex">
              <span className="text-label-md leading-tight text-on-surface">Nabila F.</span>
              <span className="text-[11px] text-body-sm leading-tight text-on-surface-variant">Finance Lead</span>
            </span>
            <ChevronDown size={16} className={cn("text-outline transition-transform duration-200", profileOpen && "rotate-180")} />
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute right-0 top-12 w-60 overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest shadow-pop"
              >
                <div className="border-b border-surface-container px-space-md py-3">
                  <span className="block text-label-md text-on-surface">Nabila Fauziah</span>
                  <span className="block text-[11.5px] text-on-surface-variant">nabila@dentico.id · Finance Lead</span>
                </div>
                {[
                  { label: "Profil & Keamanan", Icon: UserRound },
                  { label: "Preferensi Akuntansi", Icon: SlidersHorizontal },
                  { label: "Keluar Sesi", Icon: LogOut },
                ].map(({ label, Icon }) => (
                  <button
                    key={label}
                    onClick={() => { setProfileOpen(false); onAction(label); }}
                    className="flex w-full items-center gap-space-sm px-space-md py-2.5 text-left text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
