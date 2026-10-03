import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────────
 * Supabase client — the single database entry point for the app.
 *
 * Supabase (managed PostgreSQL) replaces the previous self-hosted
 * PostgreSQL + Drizzle ORM setup. There is no server-side runtime:
 * the browser talks to Supabase's PostgREST/RPC API directly using the
 * public anon key, and Row Level Security on every table is what
 * protects the data.
 *
 * Configure via a local `.env` file (see `.env.example`):
 *   VITE_SUPABASE_URL      → https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY → Project Settings → API → anon public key
 *
 * `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are also
 * accepted so an existing Next.js-style `.env` keeps working without
 * edits.
 *
 * When no credentials are present the app runs in "demo mode": every
 * repository falls back to the bundled dummy dataset (persisted to
 * localStorage) behind an identical API surface.
 * ──────────────────────────────────────────────────────────────────── */

type EnvBag = Record<string, string | undefined>;

function readEnv(...names: string[]): string | undefined {
  const env = import.meta.env as unknown as EnvBag;
  for (const name of names) {
    const value = (env[name] ?? env[`VITE_${name}`])?.trim();
    if (value) return value;
  }
  return undefined;
}

/** e.g. "gmumwjdvnbcksfgykywk" from the project URL — shown in the sidebar. */
function projectRefOf(url: string | undefined): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export const supabaseUrl = readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = readEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseProjectRef = projectRefOf(supabaseUrl);

export const supabase: SupabaseClient | null =
  isSupabaseEnabled && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "public" },
      })
    : null;

/** Convenience flag so pages can show the real failure reason. */
export const supabaseConfigError: string | null = !supabaseUrl
  ? "VITE_SUPABASE_URL belum diisi"
  : !supabaseAnonKey
    ? "VITE_SUPABASE_ANON_KEY belum diisi"
    : null;

export const SUPABASE_TABLE = "coa_accounts";

/** Every table/view this build reads, for diagnostics in the sidebar. */
export const SUPABASE_OBJECTS = [
  SUPABASE_TABLE,
  "finance_monthly",
  "finance_overview_meta",
  "journals",
  "journal_lines",
  "gl_supplements",
  "pnl_account_postings",
] as const;
