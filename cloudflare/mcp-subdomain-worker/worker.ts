/**
 * *.callvaultai.com — MCP subdomain routing Worker.
 *
 * This Worker handles per-org subdomain MCP requests (e.g., acme.callvaultai.com/mcp).
 * It extracts the org slug from the subdomain, validates it, and routes the request
 * to the appropriate Supabase Edge Function.
 *
 * Enumeration protections (ISC-44–47):
 *   ISC-44: All non-routable paths return { "error": "not_found" } — identical body
 *           regardless of whether the slug is unknown, reserved, or tombstoned.
 *   ISC-45: No body differentiation between reserved slugs, tombstoned slugs, and
 *           simply unknown slugs — always { "error": "not_found" }.
 *   ISC-47: 100ms artificial delay floor on all 404 responses to collapse timing oracle.
 *           Valid-slug paths may involve a DB lookup (slow path); invalid-slug paths
 *           would otherwise fast-reject (short path). The delay closes the timing gap.
 *
 * ISC-46: Cloudflare rate limit rule required — configure via API (Task 2 checkpoint);
 *         Zone callvaultai.com, path *.callvaultai.com/*, unauthenticated requests,
 *         max 20 req/min per IP, action 429.
 *
 * TODO: Full routing implemented in the worker-routing plan (Wave 4).
 *       This skeleton ensures enumeration protections are in place during phased rollout.
 */

export interface Env {
  // Secret used to authenticate Worker → Supabase Edge Function calls.
  // Set via: wrangler secret put CALLVAULT_INTERNAL_SECRET
  CALLVAULT_INTERNAL_SECRET: string;
}

/**
 * uniformNotFound returns an identical 404 response for ALL non-routable paths.
 *
 * ISC-44: The body is always { "error": "not_found" } — no distinguishing info
 *   about whether the slug is valid-but-unauthenticated, reserved, tombstoned,
 *   or simply unknown. Attacker cannot enumerate valid org slugs from the body.
 *
 * ISC-47: A 100ms artificial delay floor collapses the timing oracle.
 *   Valid slugs would normally trigger a DB lookup (slow path ~50ms+), whereas
 *   an invalid slug format could be rejected in microseconds (fast path). The
 *   100ms floor erases that timing differential from the attacker's perspective.
 *
 * The delay is a floor, not a cap — if the upstream response takes longer than
 * 100ms, the delay resolves immediately (Promise.race behaviour in the real
 * implementation). For this skeleton, we always apply the full delay.
 */
async function uniformNotFound(): Promise<Response> {
  // ISC-47: 100ms delay floor to collapse timing oracle
  await new Promise<void>((r) => setTimeout(r, 100));

  // ISC-44/45: Uniform body — no differentiation between slug states
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * extractSlug parses the org slug from the request's subdomain.
 *
 * e.g., https://acme.callvaultai.com/mcp → "acme"
 *       https://callvaultai.com/mcp      → null  (no subdomain)
 *       https://app.callvaultai.com/mcp  → null  (reserved subdomain)
 *
 * Reserved subdomains that must never be treated as org slugs:
 *   app, api, mcp, www, mail, smtp, ftp, docs, status, admin, dashboard,
 *   staging, dev, beta, preview
 *
 * Returns null for invalid or reserved subdomains.
 */
const RESERVED_SUBDOMAINS = new Set([
  "app",
  "api",
  "mcp",
  "www",
  "mail",
  "smtp",
  "ftp",
  "docs",
  "status",
  "admin",
  "dashboard",
  "staging",
  "dev",
  "beta",
  "preview",
]);

function extractSlug(url: URL): string | null {
  // hostname format: {slug}.callvaultai.com
  const hostname = url.hostname;
  const suffix = ".callvaultai.com";
  if (!hostname.endsWith(suffix)) return null;

  const slug = hostname.slice(0, hostname.length - suffix.length);
  if (!slug || slug.includes(".")) return null; // no slug or nested subdomains

  // ISC-45: Reserved slugs return uniformNotFound — no body differentiation
  if (RESERVED_SUBDOMAINS.has(slug)) return null;

  // Slug format validation: lowercase alphanumeric + hyphens, 3–32 chars
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) return null;

  return slug;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Extract org slug from subdomain.
    // ISC-44/45: Invalid or reserved subdomains return uniformNotFound (with 100ms delay).
    const slug = extractSlug(url);
    if (!slug) {
      return uniformNotFound();
    }

    // Route: /{slug}.callvaultai.com/mcp only — all other paths 404.
    // TODO (worker-routing plan): add additional path routing as needed.
    if (url.pathname !== "/mcp" && !url.pathname.startsWith("/mcp/")) {
      // ISC-44: uniform not_found for unrecognised paths (includes slug enumeration attempts)
      return uniformNotFound();
    }

    // TODO (worker-routing plan): validate slug against DB, forward to Supabase Edge Function.
    // For now, return not_found until full routing is implemented.
    // The 100ms delay is applied inside uniformNotFound() for all 404 paths.
    return uniformNotFound();
  },
};
