---
plan: 38-02
phase: 38
title: npm audit cleanup — zero high/critical
status: complete
completed: 2026-05-12
requirements: [SEC-03A, SEC-03B]
---

# Plan 38-02 Summary

## What was built

Drove `npm audit --omit=dev` from `1 critical, 1 high, 4 moderate` down to `0 critical, 0 high, 2 moderate`. Added a CI gate that blocks merge on any future high/critical regression. Documented every remaining moderate with explicit accept/defer rationale.

## Changes

**package.json:**
- Added `overrides` block: `{ "lodash": "^4.18.0" }` — pins transitive lodash to a version above the unpatched CVE range (`<=4.17.23`).
- Direct postcss dep bumped from `^8.5.6` to `^8.5.10` (closes GHSA-qx2v-qp2m-jg93).

**package-lock.json:** regenerated via `npm install` + `npm audit fix`. lodash now resolves to `4.18.1` (was `4.17.23`).

**.github/workflows/ci.yml:** new `npm-audit` job runs `npm audit --omit=dev --audit-level=high`. Non-zero exit blocks merge. Sits in the lint-typecheck wave so it short-circuits broken installs.

**docs/security/dependency-status.md (new):** documents the baseline-vs-current state, the two patched packages, and explicit rationale for the 2 remaining moderates (esbuild + vite — dev-server-only, deferred to v2.3 Vite 8 migration).

## Audit baseline → final

| Severity | Phase 28 baseline | Post-Phase-38 |
|----------|------------------:|--------------:|
| Critical | 0 | 0 |
| High | 1 (lodash) | **0** |
| Moderate | 4 (lodash transitives, dompurify, esbuild, postcss, vite) | 2 (esbuild, vite — dev-only) |
| Low | 0 | 0 |

## Why dompurify dropped

`grep -rn "DOMPurify" src/` returns no hits. The package only entered the tree transitively via `jspdf`/`docx` for PDF export. Recent jspdf/docx releases moved off the vulnerable dompurify range — `npm install` after the override push resolved the chain.

## Why 2 moderates remain (and are acceptable)

Both are **dev-server-only** (vite + esbuild). The CVE (GHSA-67mh-4wv8-2f99) only affects `vite dev` against an open browser tab; `vite build` produces static assets and runs esbuild at build time. Production users are unaffected. The fix is `vite@5 → vite@8` which is a breaking change; deferred to v2.3 alongside Tailwind v3 → v4.

## Verification

- `npm audit --omit=dev --json | node -e ... metadata.vulnerabilities` → `{"info":0,"low":0,"moderate":2,"high":0,"critical":0,"total":2}`
- `npm audit --omit=dev --audit-level=high; echo exit=$?` → `exit=0` (CI gate passes locally).
- `npm ls lodash` → `lodash@4.18.1` via `@tremor/react → recharts`.
- `npm run type-check` exits 0.
- `npm run build` exits 0 (build size unchanged).
- `npx js-yaml .github/workflows/ci.yml` exits 0 (valid YAML).

## Self-Check: PASSED

- [x] `npm audit --omit=dev` shows 0 high, 0 critical.
- [x] Type-check + build both pass.
- [x] CI gate `npm-audit` added (no `|| true` suffix).
- [x] `docs/security/dependency-status.md` documents every moderate.
- [x] SEC-03A satisfied.
- [x] SEC-03B satisfied (4 moderates → 2 fixed, 2 documented as DEFERRED with rationale).
