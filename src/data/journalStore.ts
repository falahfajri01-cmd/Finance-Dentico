import { fetchJournals, onJournalsChanged } from "./journalRepository";
import type { Journal } from "./journal";

/**
 * Central registry of journals for the whole app shell.
 *
 * Before this store existed, EACH mounted page fetched its own copy of the
 * registry from journalRepository (a fetch silo). When the Jurnal module
 * posted JV-0144, only its copy got the update; Buku Besar — which stays
 * mounted for state preservation — kept reading the older copy, so the
 * freshly-posted journal "never appeared" in the GL.
 *
 * Now there is exactly one truth that every module subscribes to.
 */

let store: Journal[] = [];
let initialized = false;
let living = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try { l(); } catch { /* isolated listener error */ }
  });
}

export function subscribeJournals(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getJournals(): Journal[] {
  return store;
}

/** Hard pull from repository (awaitable so the caller can chain). */
export async function refreshJournals(): Promise<void> {
  try {
    const r = await fetchJournals();
    if (r.data.length > 0) {
      store = r.data;
      emit();
    }
  } catch {
    /* keep last-known-good registry */
  }
}

/** One-time warm-up when the app boots. */
export function initJournalStore(): void {
  if (initialized || living) return;
  initialized = true;
  living = true;

  // initial load
  void refreshJournals();

  // propagate every mutation (save/post/approve/delete) instantly
  onJournalsChanged(() => {
    void refreshJournals();
  });

  // shared localStorage across tabs/demo reloads
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("dentico.journals")) {
        void refreshJournals();
      }
    });
  }
}

/** Direct write-through (used by the Journal module to stay immediate). */
export function setStoreJournals(next: Journal[]): void {
  store = next;
  emit();
}
