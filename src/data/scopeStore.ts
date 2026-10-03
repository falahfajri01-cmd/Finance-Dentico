/**
 * Central store for Brand & Cabang (Branch) options.
 *
 * Any module can add a brand/branch, and every other module's
 * filter dropdowns will immediately reflect the addition via
 * a subscription mechanism (same pattern as journalStore).
 */

export interface Brand {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  name: string;       // display name, e.g. "Yogyakarta - Gejayan"
  brandId: string;     // links to Brand.id
}

/* ── Defaults (seed data) ──────────────────────────────────────────── */
const DEFAULT_BRANDS: Brand[] = [
  { id: "brand-a", name: "Brand A" },
  { id: "brand-b", name: "Brand B" },
  { id: "dentico-core", name: "Dentico Core" },
];

const DEFAULT_BRANCHES: Branch[] = [
  { id: "br-yk", name: "Yogyakarta - Gejayan", brandId: "brand-a" },
  { id: "br-jkt", name: "Jakarta Selatan", brandId: "brand-b" },
  { id: "br-sby", name: "Surabaya Timur", brandId: "brand-a" },
  { id: "br-ho", name: "Consolidated HO", brandId: "dentico-core" },
];

const LS_BRANDS = "dentico.brands.v1";
const LS_BRANCHES = "dentico.branches.v1";

/* ── State ─────────────────────────────────────────────────────────── */
let brands: Brand[] = [];
let branches: Branch[] = [];

function loadFromStorage() {
  try {
    const b = localStorage.getItem(LS_BRANDS);
    brands = b ? JSON.parse(b) : [...DEFAULT_BRANDS];
  } catch { brands = [...DEFAULT_BRANDS]; }
  try {
    const b = localStorage.getItem(LS_BRANCHES);
    branches = b ? JSON.parse(b) : [...DEFAULT_BRANCHES];
  } catch { branches = [...DEFAULT_BRANCHES]; }
}

function persist() {
  try { localStorage.setItem(LS_BRANDS, JSON.stringify(brands)); } catch { /* noop */ }
  try { localStorage.setItem(LS_BRANCHES, JSON.stringify(branches)); } catch { /* noop */ }
}

// Initialize on module load
loadFromStorage();

/* ── Subscriptions ─────────────────────────────────────────────────── */
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => { try { l(); } catch { /* isolated */ } });
}

export function subscribeScopeStore(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/* ── Getters ───────────────────────────────────────────────────────── */
export function getBrands(): Brand[] { return brands; }
export function getBranches(): Branch[] { return branches; }

/** Returns branches for a specific brand, or all if brandId is null */
export function getBranchesForBrand(brandId: string | null): Branch[] {
  if (!brandId) return branches;
  return branches.filter((b) => b.brandId === brandId);
}

/** Build filter-friendly options: "Brand A - Yogyakarta - Gejayan" */
export function getBranchFilterOptions(): string[] {
  return branches.map((br) => {
    const brand = brands.find((b) => b.id === br.brandId);
    return brand ? `${brand.name} - ${br.name}` : br.name;
  });
}

/** Brand names for entity filter dropdown */
export function getBrandFilterOptions(): string[] {
  return ["Dentico Group (Consolidated)", ...brands.map((b) => b.name)];
}

/** Branch names for scope filter dropdown (with "Semua" option) */
export function getCabangFilterOptions(): string[] {
  return ["Semua Cabang (Grup)", ...getBranchFilterOptions()];
}

/* ── Mutators ──────────────────────────────────────────────────────── */
export function addBrand(name: string): Brand {
  const id = `brand-${Date.now().toString(36)}`;
  const brand: Brand = { id, name: name.trim() };
  brands = [...brands, brand];
  persist();
  emit();
  return brand;
}

export function addBranch(name: string, brandId: string): Branch {
  const id = `br-${Date.now().toString(36)}`;
  const branch: Branch = { id, name: name.trim(), brandId };
  branches = [...branches, branch];
  persist();
  emit();
  return branch;
}

/** Brand filter options for Jurnal Umum form (simple names) */
export function getJurnalBrandOptions(): string[] {
  return brands.map((b) => b.name);
}

/** Branch filter options for Jurnal Umum form */
export function getJurnalBranchOptions(): string[] {
  return branches.map((br) => {
    const brand = brands.find((b) => b.id === br.brandId);
    return brand ? `${brand.name} - ${br.name}` : br.name;
  });
}
