import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import OverviewPage from "./components/overview/OverviewPage";
import CoaPage from "./components/CoaPage";
import JournalPage from "./components/journal/JournalPage";
import GlPage from "./components/ledger/GlPage";
import PnlPage from "./components/pnl/PnlPage";
import Toasts, { type ToastItem, type PushToast } from "./components/Toasts";
import type { RegistryFilter } from "./components/journal/JournalRegistry";

/** Modules that are fully implemented in this build */
const LIVE_MODULES = new Set(["overview-keuangan", "chart-of-accounts", "jurnal-umum-and-entry", "buku-besar", "laba-rugi"]);

const LIVE_MODULE_NAMES = "Overview Keuangan, COA, Jurnal Umum, Buku Besar, dan Laba Rugi";

export default function App() {
  const [activeModule, setActiveModule] = useState<string>("overview-keuangan");
  const [mobileNav, setMobileNav] = useState(false);
  const [source, setSource] = useState<"supabase" | "demo">("demo");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  /**
   * Global search drill-down channel: typing in the topbar (or clicking a
   * drill link on the Overview) routes to COA with a preset query.
   * `n` is a nonce so identical queries re-trigger.
   */
  const [drill, setDrill] = useState<{ q: string; n: number }>({ q: "", n: 0 });
  /** Overview → Journal registry status drill (e.g. review queue) */
  const [jDrill, setJDrill] = useState<{ status: RegistryFilter | null; n: number }>({ status: null, n: 0 });
  /** COA → Buku Besar account drill (e.g. "Lihat Buku Besar Akun Ini") */
  const [lDrill, setLDrill] = useState<{ code: string | null; n: number }>({ code: null, n: 0 });

  const toastSeq = useRef(0);
  const pushToast: PushToast = useCallback((type, title, desc) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, title, desc }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ── Global search → routes into COA module ────────────────────── */
  const handleGlobalSearch = useCallback((v: string) => {
    setDrill((d) => ({ q: v, n: d.n + 1 }));
    setActiveModule("chart-of-accounts");
  }, []);

  const syncQuery = useCallback((q: string) => {
    setDrill((d) => (d.q === q ? d : { ...d, q }));
  }, []);

  /** Open the Journal module, optionally focused on a status queue */
  const openJournal = useCallback((status?: RegistryFilter) => {
    setJDrill((d) => ({ status: status ?? null, n: d.n + 1 }));
    setActiveModule("jurnal-umum-and-entry");
    window.scrollTo({ top: 0 });
  }, []);

  /** Open Buku Besar, optionally preselecting an account */
  const openLedger = useCallback((code?: string) => {
    setLDrill((d) => ({ code: code ?? null, n: d.n + 1 }));
    setActiveModule("buku-besar");
    window.scrollTo({ top: 0 });
  }, []);

  /* ── Sidebar navigation ────────────────────────────────────────── */
  const handleNavigate = useCallback(
    (path: string, label: string) => {
      setMobileNav(false);
      if (LIVE_MODULES.has(path)) {
        setActiveModule(path);
        window.scrollTo({ top: 0 });
        return;
      }
      pushToast("info", `${label} · belum diaktifkan`, `Saat ini ${LIVE_MODULE_NAMES} sudah live. Modul ini hadir pada tahap berikutnya.`);
    },
    [pushToast]
  );

  /* ── ⌘K focuses global search ──────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background text-body-md text-on-surface antialiased">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-72 border-r border-surface-container/70 shadow-soft lg:block">
        <Sidebar activePath={activeModule} onNavigate={handleNavigate} source={source} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-inverse-surface/45 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="fixed bottom-0 left-0 top-0 z-[56] w-72 shadow-pop lg:hidden"
            >
              <Sidebar
                activePath={activeModule}
                onNavigate={handleNavigate}
                source={source}
                onClose={() => setMobileNav(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Topbar (global search drills into COA) */}
      <Topbar
        query={drill.q}
        onQueryChange={handleGlobalSearch}
        onOpenMobileNav={() => setMobileNav(true)}
        onAction={(label) => pushToast("info", label, "Fitur profil tersedia pada rilis penuh Dentico Core.")}
      />

      {/* Pages — both stay mounted so filters/selection survive navigation */}
      <div className="lg:pl-72">
        <main className="relative w-full px-space-md pb-16 pt-[88px] lg:px-space-lg">
          <section hidden={activeModule !== "overview-keuangan"}>
            <OverviewPage pushToast={pushToast} onDrillCoa={handleGlobalSearch} onOpenJournal={openJournal} onOpenLedger={() => openLedger()} />
          </section>
          <section hidden={activeModule !== "chart-of-accounts"}>
            <CoaPage drill={drill} onQuerySync={syncQuery} onSource={setSource} pushToast={pushToast} onOpenLedger={openLedger} />
          </section>
          <section hidden={activeModule !== "jurnal-umum-and-entry"}>
            <JournalPage pushToast={pushToast} statusDrill={jDrill} />
          </section>
          <section hidden={activeModule !== "buku-besar"}>
            <GlPage pushToast={pushToast} ledgerDrill={lDrill} onOpenJournal={() => openJournal()} />
          </section>
          <section hidden={activeModule !== "laba-rugi"}>
            <PnlPage pushToast={pushToast} onOpenLedger={openLedger} />
          </section>
        </main>
      </div>

      <Toasts items={toasts} />
    </div>
  );
}
