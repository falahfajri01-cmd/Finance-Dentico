import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normalise a public base path.
 *   ""  | "/"          → "/"        (domain root, e.g. cPanel public_html)
 *   "finance"          → "/finance/"
 *   "/finance"         → "/finance/"
 * Vite requires a leading *and* trailing slash for sub-path deployments.
 */
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig(({ mode }) => {
  // Load .env at config time so `base` can follow VITE_BASE_PATH.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = normalizeBase(env.VITE_BASE_PATH);

  return {
    /**
     * Public base path of the deployed site.
     * "/" for the cPanel `public_html` root, or e.g. "/finance/" when the
     * build is uploaded into a subdirectory.
     */
    base,

    plugins: [
      react(),
      tailwindcss(),
      /**
       * Collapse the whole build into a single self-contained `index.html`
       * (JS + CSS inlined). This is what makes the cPanel upload trivial:
       * one file, zero server config, no Node.js runtime, no asset paths to
       * break. `public/.htaccess` is copied to the output root as-is.
       */
      viteSingleFile({
        useRecommendedBuildConfig: true,
        removeViteModuleLoader: true,
        deleteInlinedFiles: true,
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    build: {
      /** Browser floor — avoids modern syntax that older cPanel visitors choke on. */
      target: "es2019",
      outDir: "dist",
      assetsDir: "assets",
      /** No sourcemaps in production: smaller upload, no source disclosure. */
      sourcemap: false,
      chunkSizeWarningLimit: 4096,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
});
