# Dependency Security Status

**Last audited:** 2026-05-12 (Phase 38, SEC-03A / SEC-03B)
**Next audit:** v2.3 milestone start, or on Dependabot/Renovate alert.

## Summary

`npm audit --omit=dev` baseline post-Phase-38: **0 critical, 0 high, 2 moderate, 0 low**.

## Fixed in Phase 38

| Package | Before | After | CVE / Advisory | Method |
|---------|--------|-------|----------------|--------|
| lodash (transitive via @tremor/react → recharts) | 4.17.23 | 4.18.1 | GHSA-r5fr-rjxr-66jc (Code Injection via `_.template`), GHSA-f23m-r3pf-42rh (Prototype Pollution via `_.unset` / `_.omit`) | `package.json overrides.lodash: ^4.18.0` + `npm audit fix` to refresh the lockfile |
| postcss (direct dev dep) | ^8.5.6 | ^8.5.10 | GHSA-qx2v-qp2m-jg93 (XSS via Unescaped `</style>` in CSS Stringify) | Direct `package.json` bump |

The lodash entry crossed an SBOM line from "vulnerable" to "clean" — `npm audit --omit=dev` no longer reports it because installed 4.18.1 is above the advisory's `<=4.17.23` upper bound.

## Accepted / Deferred Moderates

### esbuild (transitive via vite)

- **Status:** Deferred to v2.3.
- **Path:** `vite@5.4.x` → `esbuild`
- **CVE:** GHSA-67mh-4wv8-2f99 — "esbuild enables any website to send any requests to the development server and read the response."
- **Exposure:** **Dev-server-only vulnerability.** The CVE only affects `vite dev` (local dev workflow). `vite build` produces static assets and runs esbuild at build time; the built production bundle does not include a running esbuild dev server. The attack vector requires a browser to be open against the local dev server AND a malicious site to issue cross-origin requests to it. Production users are not affected.
- **Mitigation today:** Run `vite dev` only against trusted origins. Do not expose the dev server externally (Vite binds to `localhost` by default).
- **Path to fix:** `npm audit fix --force` would install `vite@8.0.12`, which is a breaking change (Vite 6 → 7 → 8 each introduce migration steps). Deferred to v2.3 alongside the Tailwind v3 → v4 migration (also breaking).
- **Tracked:** v2.3 BACKLOG.

### vite (the package itself)

- **Status:** Same as esbuild above — both findings stem from the same chain.
- **Path:** Direct dev dependency.
- **CVE:** Same advisory (vite is flagged because it depends on a vulnerable esbuild range).
- **Mitigation:** Identical — dev-only, scoped to localhost, addressed when v2.3 ships the Vite 5 → 8 migration.

## CI Gate

`.github/workflows/ci.yml` contains job `npm-audit` that runs `npm audit --omit=dev --audit-level=high` on every PR. Any new high or critical finding fails the build.

The existing `.github/workflows/security.yml` runs `npm audit --audit-level=moderate || true` — that one is **informational only**. The `ci.yml` job is the **blocking gate**.

## Re-running the Audit

```bash
npm audit --omit=dev
npm audit --omit=dev --json | node -e "
let s='';
process.stdin.on('data', d => s += d);
process.stdin.on('end', () => {
  const r = JSON.parse(s);
  console.log(JSON.stringify(r.metadata.vulnerabilities));
});
"
```

Expected output post-Phase-38: `{"info":0,"low":0,"moderate":2,"high":0,"critical":0,"total":4}` (or fewer if upstream upstream patches land).

## Update Cadence

- **Weekly:** No (Dependabot/Renovate is deferred to v2.3 — see DEFERRED-1 in CONTEXT.md).
- **Per-PR:** CI gate catches new high/critical.
- **Per-milestone:** Review this document and refresh.

## Production Runtime Risk Posture

Post-Phase-38, the production runtime ships with **zero high/critical** known CVEs in production dependencies. The 2 remaining moderate findings (esbuild, vite) are dev-server-only and do not ship to production.

## History

| Date | Audit Result | Action |
|------|--------------|--------|
| 2026-05-11 (Phase 28 baseline) | 1 critical, 1 high, 4 moderate, 0 low | Established baseline |
| 2026-05-12 (Phase 38 close) | 0 critical, 0 high, 2 moderate, 0 low | lodash + postcss patched; esbuild + vite deferred to v2.3 |
