import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Configure via environment variables (see `.env.example`):
 *   VITE_SUPABASE_URL      → https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY → public anon key
 *
 * When no credentials are present the app automatically runs in
 * "demo mode" — the repository falls back to the bundled dummy
 * dataset (persisted to localStorage) with an identical API surface.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url as string, anonKey as string)
  : null;

export const SUPABASE_TABLE = "coa_accounts";
