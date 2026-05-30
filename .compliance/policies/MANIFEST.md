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

## Tier 2 — Auditor-required (ALL 17 DRAFTED ✅)

Required for SOC 2 Type I attestation. All derive from the Information Security Policy and substitute from `.compliance/facts.yaml`. Compact form (1-2 pages each, auditor-readable structure).

| # | Policy | File | Status |
|---|---|---|---|
| 7 | Logging & Monitoring Policy | `07-logging-and-monitoring-policy.md` | ✅ v1.0 |
| 8 | Risk Assessment Policy | `08-risk-assessment-policy.md` | ✅ v1.0 |
| 9 | Vulnerability Management Policy | `09-vulnerability-management-policy.md` | ✅ v1.0 |
| 10 | Change Management Policy | `10-change-management-policy.md` | ✅ v1.0 |
| 11 | BCDR Policy | `11-business-continuity-and-dr-policy.md` | ✅ v1.0 |
| 12 | Acceptable Use Policy | `12-acceptable-use-policy.md` | ✅ v1.0 |
| 13 | Asset Management Policy | `13-asset-management-policy.md` | ✅ v1.0 |
| 14 | Code of Conduct | `14-code-of-conduct.md` | ✅ v1.0 |
| 15 | Cryptography & Encryption Policy | `15-cryptography-and-encryption-policy.md` | ✅ v1.0 |
| 16 | HR Security Policy | `16-hr-security-policy.md` | ✅ v1.0 |
| 17 | Security Awareness Training Policy | `17-security-awareness-training-policy.md` | ✅ v1.0 |
| 18 | Network Security Policy | `18-network-security-policy.md` | ✅ v1.0 |
| 19 | Password Policy | `19-password-policy.md` | ✅ v1.0 |
| 20 | Physical Security Policy | `20-physical-security-policy.md` | ✅ v1.0 |
| 21 | Secure Development + SDLC Policy | `21-secure-development-policy.md` | ✅ v1.0 |
| 22 | Supplier Security Policy | `22-supplier-security-policy.md` | ✅ v1.0 |
| 23 | Workstation Security Policy | `23-workstation-security-policy.md` | ✅ v1.0 |

**Consolidated out** (folded into other policies, no separate file): Backup (→ BCDR), Patch Management (→ Vulnerability Management), Subprocessor Management (→ Vendor Management), Third-party Risk Management (→ Vendor + Supplier), Encryption (→ Cryptography), Secure SDLC (→ Secure Development).

**Live distinct-policy count: 23 policies** (6 Tier-1 + 17 Tier-2) — ALL DRAFTED.

## Tier 3 — Customer-facing legal (separate from policy library)

These are public legal documents. **2 of 3 trifecta items already published** at `callvaultai.com` (source repo at `/Users/admin/dev/callvault-website/public/`). Discovered 2026-05-29 after initial scan was scoped to `brain/` only.

| # | Document | Status | Source | Notes |
|---|---|---|---|---|
| L1 | Terms of Service | ✅ PUBLISHED | `callvaultai.com/terms` | Termly-generated, last updated 2025-11-02. Confirms 7x Systems LLC, Wyoming governing law, Sheridan WY address |
| L2 | Privacy Policy | ✅ PUBLISHED | `callvaultai.com/privacy` | Termly-generated, ~231KB. Covers GDPR + CCPA + California + Europe + cookies + controller/processor + retention + deletion |
| L3 | Cookie Policy | ✅ PUBLISHED | `callvaultai.com/cookies` | Termly-generated companion to Privacy |
| L4 | Data Processing Addendum (DPA) | ✅ PUBLISHED | `callvaultai.com/dpa` | Based on Common Paper DPA v2.0 (CC-BY-4.0). Module Two: Controller to Processor. EU SCCs incorporated by reference. Drafted 2026-05-29 |
| L5 | Trust page | ✅ PUBLISHED | `callvaultai.com/trust` | Lists subprocessors, security controls, compliance posture, deletion paths, security contact. Drafted 2026-05-29 |
| L6 | Business Associate Agreement (BAA) | not required | — | Only if HIPAA-eligible workspaces ship |

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
