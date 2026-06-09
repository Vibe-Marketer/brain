# Phase 03-07: MCP Subdomain Routing — Execution Plan

**ISA:** `~/.claude/PAI/MEMORY/WORK/20260608-mcp-subdomain-routing-arch/ISA.md`
**Total ISCs:** 181 (ISC-1–56 security gates, ISC-57–132 implementation)
**Gate rule:** No wildcard DNS provisioning until all Critical/High security ISCs are closed.

---

## Dependency Graph

```
WAVE 1 — Fully parallel (no dependencies, start immediately)
├── sec-jwt-fix          ISC-8–12   | Remove readClientIdFromJwt(), use getUser() result only
├── sec-dcr-phishing     ISC-13–19  | Consent page: client_id + first-seen warning + DCR rate limit
├── sec-revocation-complete ISC-27–34 | Extend triggers → mcp_oauth_client_grants; signOut on removal
├── sec-workspace-param  ISC-35–38  | Validate ?workspace_id against selected org in consent page
├── sec-worker-headers   ISC-39–43  | Strip XFF chain; filter auth route query params in Worker
├── sec-multiorg-grant   ISC-48–50  | Fix selectOAuthGrant → 403 on multi-org ambiguity
└── sec-tool-audit       ISC-51–56  | Audit tool handlers; fix create_organization limit; YouTube SSRF

WAVE 1b — Parallel, no deps (can run alongside Wave 1)
└── sec-worker-bypass    ISC-1–7    | Internal secret header in ALL edge functions + IP allowlist
                                     | (runs parallel but other features depend on it)

WAVE 2 — After sec-worker-bypass completes
└── sec-enumeration      ISC-44–47  | Uniform 404 + Cloudflare rate limit + 100ms floor

WAVE 3 — After sec-slug-tombstone completes (no other deps)
└── sec-slug-tombstone   ISC-20–26  | Tombstone tables + DELETE triggers
    └── slug-schema      ISC-66–74, ISC-105–111
                                     | Slug columns on orgs + workspaces; backfill; grants migration

WAVE 4 — After slug-schema completes
└── worker-routing       ISC-57–65, ISC-75–81
                                     | New cloudflare/mcp-subdomain-worker/worker.ts
    ├── [parallel] auth-slug-resolution  ISC-82–89  | auth.ts slug header → org resolution
    ├── [parallel] protocol-subdomain    ISC-90–93  | protocol.ts subdomain host/path
    ├── [parallel] oauth-metadata-scoped ISC-94–97  | /.well-known/ at subdomain URL
    └── [parallel] backward-compat       ISC-120–124| Deprecation header; legacy URLs untouched

WAVE 4b — After slug-schema (parallel to worker-routing)
├── oauth-auth-screen    ISC-98–104 | Pre-scoped consent screen (also needs sec-dcr-phishing)
└── ui-url-builder       ISC-112–119| buildScopedMcpUrl(); MCP tab shows 3 URL types
```

---

## What Can Run in Parallel

| Parallel batch | Features | Effort estimate |
|----------------|----------|-----------------|
| **Batch A** (Wave 1 + 1b) | sec-jwt-fix, sec-dcr-phishing, sec-revocation-complete, sec-workspace-param, sec-worker-headers, sec-multiorg-grant, sec-tool-audit, sec-worker-bypass | 7 independent streams |
| **Batch B** (Wave 2, after sec-worker-bypass) | sec-enumeration | 1 stream, unblocks after ~1hr |
| **Batch C** (Wave 3) | sec-slug-tombstone → slug-schema | Sequential pair, ~half day |
| **Batch D** (Wave 4) | worker-routing → {auth-slug-resolution, protocol-subdomain, oauth-metadata-scoped, backward-compat, oauth-auth-screen, ui-url-builder} | Worker builds first, then 6-way fan-out |

---

## What Is Strictly Sequential

```
sec-slug-tombstone → slug-schema → worker-routing
```

- Tombstone tables must exist before slugs are ever written (DELETE trigger on the slug columns)
- Slug columns must exist before the Worker can do slug→org_id DB lookups
- Worker must exist before auth-slug-resolution / protocol-subdomain / oauth-metadata-scoped can be tested end-to-end

---

## Security Gate Status (all must be ✅ before DNS wildcard)

- [ ] sec-worker-bypass    — CRITICAL: direct Supabase URL bypass
- [ ] sec-jwt-fix           — CRITICAL: JWT claim without sig verification
- [ ] sec-dcr-phishing      — CRITICAL: anonymous DCR + phishing consent
- [ ] sec-slug-tombstone    — CRITICAL: deleted slug re-registration
- [ ] sec-revocation-complete — HIGH: OAuth grants not covered by revocation triggers
- [ ] sec-workspace-param   — HIGH: ?workspace_id pre-populates adversarial workspace
- [ ] sec-worker-headers    — HIGH: ships with new Worker
- [ ] sec-enumeration       — MEDIUM: rate limit + uniform 404

---

## Fastest Path to First Subdomain URL

1. **Day 1:** Run Batch A in parallel (7 security fixes, no deps)
2. **Day 1–2:** sec-slug-tombstone → slug-schema (sequential pair)
3. **Day 2:** sec-enumeration (after sec-worker-bypass from Batch A)
4. **Day 3:** worker-routing (after slug-schema + all security gates green)
5. **Day 3–4:** Fan out: auth-slug-resolution, protocol-subdomain, oauth-metadata-scoped, oauth-auth-screen, ui-url-builder, backward-compat
6. **Day 4:** Provision wildcard DNS → first org gets subdomain URL

---

## Files Touched Per Feature

| Feature | Primary files |
|---------|---------------|
| sec-worker-bypass | `supabase/functions/mcp-server/index.ts`, `supabase/functions/mcp-oauth-*/index.ts`, `cloudflare/api-proxy/worker.ts` |
| sec-jwt-fix | `supabase/functions/mcp-server/auth.ts` |
| sec-dcr-phishing | `src/pages/OAuthConsentPage.tsx`, Cloudflare dashboard (rate limit rule) |
| sec-slug-tombstone | new migration: `supabase/migrations/YYYYMMDD_slug_tombstone.sql` |
| sec-revocation-complete | new migration: `supabase/migrations/YYYYMMDD_revocation_triggers.sql` |
| sec-workspace-param | `src/pages/OAuthConsentPage.tsx` |
| sec-worker-headers | `cloudflare/api-proxy/worker.ts` |
| sec-multiorg-grant | `supabase/functions/mcp-server/grant-selection.ts` |
| sec-tool-audit | `supabase/functions/mcp-server/tools/**/*.ts` |
| slug-schema | new migration: `supabase/migrations/YYYYMMDD_org_workspace_slugs.sql` |
| worker-routing | new file: `cloudflare/mcp-subdomain-worker/worker.ts` |
| auth-slug-resolution | `supabase/functions/mcp-server/auth.ts` |
| protocol-subdomain | `supabase/functions/mcp-server/lib/protocol.ts` |
| oauth-metadata-scoped | `supabase/functions/mcp-oauth-metadata/index.ts` |
| oauth-auth-screen | `src/pages/OAuthConsentPage.tsx` |
| ui-url-builder | `src/services/mcp-tokens.service.ts`, `src/components/mcp/McpSetupSnippets.tsx` |
| backward-compat | `cloudflare/api-proxy/worker.ts` (add Deprecation header) |
