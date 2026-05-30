---
policy_id: RAP-008
title: Risk Assessment Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC3.1", "CC3.2", "CC3.3", "CC3.4", "CC9.1"]
---

# Risk Assessment Policy

## 1. Purpose

Defines how CallVault identifies, evaluates, and treats information-security risks.

## 2. Scope

All assets, systems, data, vendors, and operational processes within the scope of the Information Security Policy.

## 3. Methodology

CallVault uses a **qualitative impact × likelihood** rating:

| Impact | Definition |
|--------|------------|
| Critical (4) | Unauthorized access to customer data, full production outage > 2h, irrecoverable data loss |
| High (3) | Partial customer data exposure, multi-hour outage, single-customer impact requiring notification |
| Medium (2) | Operational degradation, internal-only impact, recoverable |
| Low (1) | Minor inconvenience, easily mitigated |

| Likelihood | Definition |
|------------|------------|
| Likely (4) | Expected within 12 months absent control |
| Possible (3) | Plausible within 12 months |
| Unlikely (2) | Possible but not expected |
| Rare (1) | Edge case requiring multiple failures |

**Risk score = Impact × Likelihood (1–16).** Scores ≥ 9 require active mitigation; 5–8 require accepted-risk documentation; ≤ 4 are tracked but not actively treated.

## 4. Risk Register

The risk register is maintained at `.compliance/risk-register.yaml` (to be initialized in the next session). Each entry includes:

- ID (RISK-NNN)
- Description
- Asset(s) affected
- Impact, Likelihood, Score
- Treatment (mitigate / accept / transfer / avoid)
- Owner
- Target review date

## 5. Cadence

- **Annual** full review by the Information Security Officer
- **Interim** review on material change: new subprocessor, new workforce member with production access, security-relevant incident, material regulatory change

## 6. Known Risks (as of effective date)

The Information Security Officer has identified the following risks for the inaugural register; full entries follow in `.compliance/risk-register.yaml`:

| ID | Risk | Score | Treatment |
|----|------|-------|-----------|
| RISK-001 | Single-principal bus factor — sole admin of all production systems | High (12) | Accept; mitigation via 1Password emergency kit + BCDR Policy continuity playbook |
| RISK-002 | No cyber liability insurance | Medium (8) | Accept; revisit annually or on first enterprise contract |
| RISK-003 | LastPass legacy vault contains stale credentials | Medium (6) | Mitigate; in-progress migration to 1Password + credential rotation |
| RISK-004 | LLM subprocessor reliance for AI-tier MCP tools transmits transcript text externally | Medium (6) | Accept with disclosure; documented on trust page and DPA |
| RISK-005 | Indefinite default retention may exceed some customer regulatory limits | Medium (6) | Mitigate via per-call / per-workspace / per-org self-serve deletion (Data Retention Policy) |
| RISK-006 | Single-region Supabase project — no multi-region failover | Medium (6) | Accept at current stage; Supabase's own backup + restore SLA is the recovery boundary |
| RISK-007 | No formal pentest yet | Medium (8) | Mitigate at Type II preparation (after Type I attestation) |

## 7. Treatment

For each risk above ≥ 9 (or any newly identified ≥ 9), the ISO documents:

- The selected treatment (mitigate / accept / transfer / avoid)
- Specific mitigating controls if mitigating
- Acceptance justification + accepting party + revisit date if accepting
- The vendor/policy if transferring
- The change required if avoiding

## 8. Reporting

The risk register is reviewed by the principal during the annual policy review and presented to any auditor or external assessor on request.

## 9. Review

This Policy is reviewed at least annually.
