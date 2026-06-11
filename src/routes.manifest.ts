/**
 * Application route manifest.
 *
 * Single source of truth for every user-facing route registered in
 * `src/App.tsx`. Consumed by:
 *
 * - `scripts/qa/qa-crawler.ts` — decides which routes the QA crawler
 *   visits (`crawl: true` only).
 * - `src/__tests__/routes.manifest.test.ts` — asserts this list stays in
 *   sync with App.tsx so new pages cannot silently dodge QA coverage.
 *
 * Pure data module: no React, no side effects.
 *
 * Field semantics:
 * - `path`        route pattern exactly as registered in App.tsx.
 * - `label`       human-readable name for reports.
 * - `auth`        true when the route is wrapped in ProtectedRoute.
 * - `crawl`       true when the QA crawler should visit it. Routes that
 *                 need IDs/tokens (dynamic params), OAuth callbacks,
 *                 share links, and flows that mutate account state are
 *                 marked false.
 * - `destructive` true when merely interacting with the page risks
 *                 changing billing/account state — never crawled.
 *
 * Redirect-only routes (element is `<Navigate/>`) are intentionally NOT
 * listed — they are not user-facing pages and the sync test skips them.
 */

export interface AppRoute {
  path: string;
  label: string;
  auth: boolean;
  crawl: boolean;
  destructive?: boolean;
}

export const APP_ROUTES: AppRoute[] = [
  // ── Auth & entry (public) ────────────────────────────────────────────
  { path: "/login", label: "Login", auth: false, crawl: false },
  { path: "/auth", label: "Login (alias)", auth: false, crawl: false },
  { path: "/forgot-password", label: "Forgot Password", auth: false, crawl: false },
  { path: "/reset-password", label: "Reset Password", auth: false, crawl: false },

  // ── OAuth (needs provider state — never crawled) ─────────────────────
  { path: "/oauth/callback/*", label: "OAuth Callback", auth: true, crawl: false },
  { path: "/oauth/consent", label: "OAuth Consent", auth: false, crawl: false },

  // ── Onboarding (mutates setup state — never crawled) ─────────────────
  { path: "/setup", label: "Setup Wizard", auth: true, crawl: false },
  { path: "/setup/trial", label: "Setup Trial Upsell", auth: true, crawl: false, destructive: true },

  // ── Main app ─────────────────────────────────────────────────────────
  { path: "/", label: "Home (Transcripts)", auth: true, crawl: true },
  { path: "/transcripts", label: "Transcripts", auth: true, crawl: true },
  { path: "/settings", label: "Settings", auth: true, crawl: true },
  { path: "/settings/:category", label: "Settings Category", auth: true, crawl: false },
  { path: "/analytics", label: "Analytics", auth: true, crawl: true },
  { path: "/analytics/:category", label: "Analytics Category", auth: true, crawl: false },
  { path: "/people", label: "People", auth: true, crawl: true },
  { path: "/organization", label: "Organization", auth: true, crawl: true },
  { path: "/import", label: "Manual Import", auth: true, crawl: true },
  { path: "/rules", label: "Routing Rules", auth: true, crawl: true },

  // ── Admin center (16-01, role-gated by AdminGuard) ───────────────────
  { path: "/admin", label: "Admin Center", auth: true, crawl: true },
  { path: "/admin/dashboard", label: "Admin — Dashboard", auth: true, crawl: true },
  { path: "/admin/tickets", label: "Admin — Tickets", auth: true, crawl: true },
  { path: "/admin/:section", label: "Admin Section", auth: true, crawl: false },

  // ── Dynamic detail / token routes (need IDs — never crawled) ─────────
  { path: "/call/:callId", label: "Call Detail", auth: true, crawl: false },
  { path: "/s/:token", label: "Shared Call View", auth: false, crawl: false },
  { path: "/join/org/:token", label: "Organization Join", auth: false, crawl: false },
  { path: "/join/workspace/:token", label: "Workspace Join", auth: false, crawl: false },
];

/** Routes the QA crawler should visit. */
export const CRAWLABLE_ROUTES: AppRoute[] = APP_ROUTES.filter((r) => r.crawl);
