---
policy_id: SDP-021
title: Secure Development and SDLC Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC8.1", "CC5.2", "CC7.1"]
---

# Secure Development and SDLC Policy

## 1. Purpose

Defines how CallVault writes, tests, reviews, and ships code securely.

## 2. Scope

All source code, dependencies, and configuration for the `Vibe-Marketer/brain` repository (CallVault application) and the `Vibe-Marketer/callvault-website` repository (marketing site).

## 3. Branch Strategy

- `main` is the production branch
- Feature work happens on short-lived branches off `main`
- Vercel auto-deploys `main` to production on push

## 4. Pre-Merge Controls

| Control | Mechanism | Current state |
|---------|-----------|---------------|
| Pull request required | GitHub branch protection on `main` | **Not currently enforced** — see Phase A FINDINGS-001 and the corrective action |
| Approval required | GitHub branch protection on `main` | Same as above |
| Status checks required | GitHub branch protection on `main` (`security` check) | Enforced ✅ |
| Branches up-to-date | GitHub branch protection | Enforced ✅ |
| Bypass prevention | "Do not allow bypassing" rule | **Not currently set** — see FINDINGS-001 |

The corrective action (enable PR + approval + bypass-prevention on `main`) is captured in `evidence/2026-05-29/FINDINGS.md` and tracked for closure. Until closed, the live state is honestly documented here.

## 5. Code Quality Gates

For every change before merge to `main`:

- `npm run build` passes (TypeScript strict-mode compilation)
- `npm test` passes (vitest unit + integration tests)
- ESLint passes on changed files
- Vercel preview deployment builds successfully

For MCP-server changes specifically, the targeted test suites are mandatory: `category-gating.test.ts`, `write-tools-boundary.test.ts`, `contract-surface.test.ts`, `golden-replay.test.ts`, `ai-tools-invariants.test.ts`.

## 6. Dependency Management

| Control | Mechanism | Current state |
|---------|-----------|---------------|
| Dependency graph | GitHub | **Disabled** — corrective action per FINDINGS-004 |
| Dependabot alerts | GitHub | **Disabled** — corrective action per FINDINGS-004 |
| Dependabot security updates | GitHub | **Disabled** — corrective action per FINDINGS-004 |
| Lock file | `package-lock.json` committed | Yes ✅ |

The 10-minute remediation list in FINDINGS.md enables every disabled control above.

## 7. Static and Dynamic Analysis

| Control | Mechanism | Current state |
|---------|-----------|---------------|
| TypeScript strict mode | `tsconfig.json` | Enabled ✅ |
| ESLint | `.eslintrc` | Enabled ✅ |
| CodeQL analysis | GitHub | **Not set up** — corrective action per FINDINGS-004 |
| Secret scanning | GitHub | **Disabled** — corrective action per FINDINGS-004 |
| Push protection (block commits with secrets) | GitHub | **Disabled** — corrective action per FINDINGS-004 |
| Pre-commit secret detection | `gitleaks` or equivalent | Not currently enforced locally |

## 8. Secure Coding Practices

- Server-side input validation at every Edge Function boundary
- Zod schemas for structured input on critical paths
- Row Level Security on every customer-data table at the database layer
- No secrets in source code; `.env*` files in `.gitignore`
- No customer transcripts in logs

## 9. Pre-Production Environments

- **Local development** with local `.env` files
- **Vercel preview deployments** per PR (when PRs are used; see Section 4)
- Production deployments only triggered by merge to `main`

## 10. Open-Source Components

- All dependencies tracked in `package.json` and `package-lock.json`
- License review is performed for any new dependency added to a critical path

## 11. Penetration Testing

Not yet performed. Planned alongside SOC 2 Type II preparation. Responsible disclosure via `support@callvaultai.com` per the trust page.

## 12. Review

Annual or on material change to the toolchain or deployment topology.
