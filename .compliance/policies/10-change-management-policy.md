---
policy_id: CMP-010
title: Change Management Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC8.1"]
---

# Change Management Policy

## 1. Purpose

Defines how changes to CallVault production code, configuration, and infrastructure are proposed, reviewed, tested, deployed, and rolled back.

## 2. Scope

- Application source code in `Vibe-Marketer/brain`
- Supabase Edge Functions, database migrations, RLS policies
- Vercel project configuration and environment variables
- GitHub branch protection rules and Actions workflows
- DNS records, TLS configuration

## 3. Change Categories

| Category | Definition | Approval path |
|----------|------------|---------------|
| **Standard** | Routine application change | PR + branch protection review |
| **Database schema** | Supabase migration | PR + branch protection review + migration test in preview env |
| **Security configuration** | RLS policy, auth config, secret rotation | PR + branch protection review + audit-log evidence captured |
| **Emergency hotfix** | Production-down or SEV-1/SEV-2 incident response | Expedited PR; post-merge review within 24 hours |

## 4. Standard Change Workflow

1. **Plan** — change is described in a GitHub issue or in `.planning/` for non-trivial work
2. **Branch** — feature branch off `main`
3. **Build** — local development + `npm run build` + `npm test` pass before pushing
4. **PR** — pull request opened, automated checks run (Vercel preview deployment, vitest, ESLint, TypeScript build)
5. **Review** — required reviewer approval per GitHub branch protection on `main`
6. **Merge** — squash merge to `main`
7. **Deploy** — Vercel auto-deploys main to production
8. **Verify** — smoke test the affected surface (`Skill("Interceptor")` for visual verification)

## 5. Branch Protection

GitHub branch protection on `main` enforces:

- Required pull request before merge
- At least one approving review
- All status checks must pass (Vercel preview build, vitest)
- No force-push permitted
- No deletion of `main`

Branch protection bypass attempts surface in the GitHub audit log and are reviewed during quarterly access reviews.

## 6. Testing Gates

| Change category | Required gates |
|-----------------|----------------|
| Standard | `npm run build` + `npm test` green; Vercel preview build green |
| Database schema | Above + migration applied successfully to Supabase project (or local Supabase) |
| Security configuration | Above + targeted MCP server tests pass (`category-gating`, `write-tools-boundary`, `contract-surface`) |
| Emergency hotfix | Minimum: build green + targeted test for the affected surface |

Test commands are documented in `CLAUDE.md` (root) and `src/CLAUDE.md`.

## 7. Rollback

- **Vercel** — instant rollback to any prior deployment via dashboard
- **Supabase migrations** — rollback by writing and applying a reverse migration; never by manual SQL against production
- **Configuration** — revert via PR

A rollback that follows an incident is documented in the incident's post-mortem per the Incident Response Plan.

## 8. Production Access for Manual Changes

Manual changes to production (Supabase dashboard, Vercel dashboard, GitHub admin actions) are limited to:

- Subprocessor account management (already authenticated to the platform)
- Configuration changes that are not version-controlled (e.g., setting environment variables, rotating secrets)
- Emergency hotfix that cannot wait for the PR cycle

Manual changes are recorded in the platform's own audit log and reviewed during the quarterly access review.

## 9. Change Communication

- All changes are visible in `git log` on `main`
- Material customer-facing changes (UI behavior, retention, deletion mechanisms) are also documented in release notes or in-app announcements
- Subprocessor changes follow the notification process in the Vendor & Subprocessor Management Policy

## 10. Review

This Policy is reviewed at least annually or on material change to the deployment toolchain.
