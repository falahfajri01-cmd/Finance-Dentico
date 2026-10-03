import { useEffect, useState } from "react";
import {
  getBrands, getBranches, getBrandFilterOptions, getCabangFilterOptions,
  getJurnalBrandOptions, getJurnalBranchOptions, subscribeScopeStore,
  type Brand, type Branch,
} from "../data/scopeStore";

export interface ScopeSnapshot {
  brands: Brand[];
  branches: Branch[];
  brandFilterOpts: string[];
  cabangFilterOpts: string[];
  jurnalBrandOpts: string[];
  jurnalBranchOpts: string[];
}

function snap(): ScopeSnapshot {
  return {
    brands: getBrands(),
    branches: getBranches(),
    brandFilterOpts: getBrandFilterOptions(),
    cabangFilterOpts: getCabangFilterOptions(),
    jurnalBrandOpts: getJurnalBrandOptions(),
    jurnalBranchOpts: getJurnalBranchOptions(),
  };
}

export default function useScopeStore(): ScopeSnapshot {
  const [state, setState] = useState(snap);
  useEffect(() => subscribeScopeStore(() => setState(snap())), []);
  return state;
}
