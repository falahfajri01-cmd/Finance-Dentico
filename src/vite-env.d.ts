/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** https://<project-ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Project Settings → API → anon public key (never service_role) */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * Public base path the built site is served from.
   * "/" for a domain root or a cPanel `public_html` root;
   * "/finance/" when uploading into a subdirectory.
   */
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
