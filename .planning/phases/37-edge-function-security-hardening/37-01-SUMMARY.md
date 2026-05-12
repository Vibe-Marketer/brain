# Plan 37-01 Summary — Fresh Audit + Verify Deferred-P28 Closures

**Status:** COMPLETE
**Date:** 2026-05-12
**Output:** `.planning/security/2026-05-Q2-edge-audit.md`

## Headlines

- **38 functions audited** against the 12-item per-function checklist.
- **SEC-06..12 verification:** 7/7 PASS in live source. The deferred-Phase-28 High findings are closed. One sub-item — SEC-08 streaming-vs-formData — DEFERRED to v2.3 (perf concern, not security; magic-byte validation closes the security risk).
- **0 new Critical findings.** 0 new High findings beyond the already-tracked SEC-01A..D.
- **35 new Medium findings** — all of the same kind: missing `// service-role required: <reason>` rationale comments. Tracked to Phase 38 / SEC-04A.
- **24 new Low findings** — shared-auth migration (Plan 37-03).

## Follow-up Plans in This Phase

| Plan | Scope | Status |
|------|-------|--------|
| 37-02 | polar-webhook hardening (SEC-01A/B/C/D) | Pending execution |
| 37-03 | Shared-auth migration of 24 functions (SEC-02A) | Pending execution |
| 37-04 | One-shot migration to encrypt existing plaintext OAuth tokens (SEC-09) | Pending execution |
| 37-05 | Deployed-vs-source orphan reconciliation (SEC-05A/B/C) | Pending execution |

## Findings Deferred Out of Phase 37

- **SEC-04A** (service-role rationale comments) — owned by Phase 38 per ROADMAP.
- **SEC-08 streaming** — v2.3 BACKLOG.
- **Zod-on-OAuth-paths** — v2.3 BACKLOG.
- **Rate limiting on AI functions** — out of scope; tracked Info only.

## Methodology

Automated grep audit (script in audit doc Section "Methodology Notes") plus manual source review of every function cited in SEC-06..12.

## Acceptance Criteria

- [x] Audit doc exists at the mandated path.
- [x] Verification matrix for SEC-06..12 has 7 PASS rows with file:line evidence.
- [x] Per-function audit table has 38 rows.
- [x] Every Critical/High finding has a plan owner or explicit "verified-pass" note.
- [x] Summary doc lists follow-up plans by ID.
