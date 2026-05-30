---
title: Policy library manifest
last_updated: 2026-05-29
---

# Policy library manifest

Tracks the full SOC 2 Type I policy library scope. Tier-1 policies (the 6 every customer security review actually asks for) are written. Tier-2 and Tier-3 to be generated in subsequent sessions.

## Tier 1 — Customer-facing (written)

The 6 policies every CAIQ/SIG questionnaire asks about and every customer DPA review touches. Drafted 2026-05-29.

| # | Policy | File | Status |
|---|---|---|---|
| 1 | Information Security Policy | `01-information-security-policy.md` | ✅ v1.0 |
| 2 | Access Control Policy | `02-access-control-policy.md` | ✅ v1.0 |
| 3 | Data Classification Policy | `03-data-classification-policy.md` | ✅ v1.0 |
| 4 | Data Retention & Deletion Policy | `04-data-retention-and-deletion-policy.md` | ✅ v1.0 |
| 5 | Incident Response Plan | `05-incident-response-plan.md` | ✅ v1.0 |
| 6 | Vendor & Subprocessor Management Policy | `06-vendor-and-subprocessor-management-policy.md` | ✅ v1.0 |

## Tier 2 — Auditor-required (not yet written)

Required for SOC 2 Type I attestation. Each derives from the Information Security Policy and substitutes from `.compliance/facts.yaml`. Write in a future session.

| # | Policy | One-line scope | Estimated length |
|---|---|---|---|
| 7 | Acceptable Use Policy | Workforce use of CallVault systems, prohibited activities | 1-2 pages |
| 8 | Asset Management Policy | Inventory of production systems, ownership, lifecycle | 1-2 pages |
| 9 | Backup Policy | Supabase managed backup detail, restore testing cadence | 1 page |
| 10 | Business Continuity / Disaster Recovery Policy | RTO/RPO targets, failover scenarios, principal availability | 2 pages |
| 11 | Change Management Policy | Branch protection, PR review, deploy pipeline, rollback | 2 pages |
| 12 | Code of Conduct | Workforce conduct expectations | 1 page |
| 13 | Cryptography Policy | TLS, AES-256 at rest, key management posture | 1-2 pages |
| 14 | Encryption Policy | Subset of Cryptography (some templates separate them) | merge into 13 |
| 15 | HR Security Policy | Onboarding, offboarding, role changes | 2 pages |
| 16 | Information Security Awareness Policy | Annual review by principal, training expectations | 1 page |
| 17 | Logging & Monitoring Policy | Log sources, retention, review cadence, alerting | 2 pages |
| 18 | Network Security Policy | TLS posture, firewall (Vercel default), no VPN | 1 page |
| 19 | Password Policy | 1Password primary, MFA enforced, rotation cadence | 1 page |
| 20 | Patch Management Policy | Dependabot, manual review, deploy cadence | 1 page |
| 21 | Physical Security Policy | Remote-only, workstation theft, recovery | 1 page (minimal) |
| 22 | Risk Assessment Policy | Annual risk register review, named methodology | 2 pages |
| 23 | Secure Development Policy | TypeScript strict, ESLint, code review, dependency scanning | 2 pages |
| 24 | Secure SDLC Policy | Branch strategy, environments, release gates | 2 pages |
| 25 | Security Awareness Training Policy | Annual review, named topics covered | 1 page |
| 26 | Subprocessor Management Policy | Subset / consolidation with #6 | merge into 6 |
| 27 | Supplier Security Policy | Supporting vendor selection and review (separate from subprocessors) | 1-2 pages |
| 28 | Third-party Risk Management Policy | Subset of #6 and #27 | merge into 6 + 27 |
| 29 | Vulnerability Management Policy | Severity-based SLAs, remediation tracking | 1-2 pages |
| 30 | Workstation Security Policy | FileVault, OS auto-update, browser hardening, EDR posture | 1 page |

After consolidation (14 → 13, 26 → 6, 28 → 6+27), the live count of distinct policies is **27 policies**, not 30.

## Tier 3 — Customer-facing legal (separate from policy library)

These are public legal documents. **2 of 3 trifecta items already published** at `callvaultai.com` (source repo at `/Users/admin/dev/callvault-website/public/`). Discovered 2026-05-29 after initial scan was scoped to `brain/` only.

| # | Document | Status | Source | Notes |
|---|---|---|---|---|
| L1 | Terms of Service | ✅ PUBLISHED | `callvaultai.com/terms` | Termly-generated, last updated 2025-11-02. Confirms 7x Systems LLC, Wyoming governing law, Sheridan WY address |
| L2 | Privacy Policy | ✅ PUBLISHED | `callvaultai.com/privacy` | Termly-generated, ~231KB. Covers GDPR + CCPA + California + Europe + cookies + controller/processor + retention + deletion |
| L3 | Cookie Policy | ✅ PUBLISHED | `callvaultai.com/cookies` | Termly-generated companion to Privacy |
| L4 | Data Processing Addendum (DPA) | **NOT YET DRAFTED** | — | Last legal-trifecta gap. Adopt Common Paper open DPA + substitute entity facts. ~1-2 hr task. |
| L5 | Business Associate Agreement (BAA) | not required | — | Only if HIPAA-eligible workspaces ship |

## Policy ownership

All Tier 1, Tier 2, and Tier 3 documents currently have a single owner and approver: **Andrew Naegele**, sole principal of 7X Systems LLC.

## Review cadence

- **Annual** review of every policy by the Information Security Officer
- **Interim** review on material change to architecture, workforce, subprocessor list, or applicable regulation

## How to extend the library (next session)

1. Pick the next Tier 2 policy to draft (recommend in this order: Logging & Monitoring → Risk Assessment → Change Management → BCDR → Vulnerability Management; these cover the highest-value SOC 2 evidence gaps)
2. Substitute facts from `.compliance/facts.yaml` into a Tier 1-style template
3. Add the new policy file to this manifest with status `✅ v1.0`
4. Update the readiness scorer (when built) to reference the new policy

## Re-generation discipline

When `.compliance/facts.yaml` changes materially (new subprocessor, headcount change, new incident, etc.):

- All policies citing the changed fact are bumped to `v1.x` and the relevant section is regenerated
- The Manifest is updated with new `last_updated` and a note in the change history

## Change history

| Date | Author | Change |
|---|---|---|
| 2026-05-29 | Claude (under Andrew's direction) | Tier 1 (6 policies) drafted; manifest created |
