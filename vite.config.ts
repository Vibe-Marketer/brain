import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 3001,
  },
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    react(),
    // Sentry source map upload - only in production builds
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Only upload source maps in CI/production builds
      disable: !process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
    ...(process.env.ANALYZE ? [visualizer({ open: true, gzipSize: true, brotliSize: true })] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Phase 24: pure-TS shared utilities co-located with edge functions can be
      // imported by the Vite-bundled client via this alias. Only modules that
      // are zero-deps (no `Deno.*`, no `https://esm.sh/...` imports) are safe
      // to use this way — see supabase/functions/_shared/fathom-transcript-parser.ts.
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
    },
  },
});
