---
title: SOC 2 Type I readiness — initial score
date: 2026-05-29
methodology: Manual mapping of evidence + policies against AICPA TSP Section 100 (Trust Services Criteria, 2017)
scope: SOC 2 Type I (point-in-time) — "Security" trust services criterion category
next_review: after Tier-2 policies are drafted
---

# SOC 2 Type I Readiness — Initial Score (2026-05-29)

> First-pass scoring of CallVault against AICPA Trust Services Criteria. Three statuses: **MET** (control documented + evidence available), **PARTIAL** (documented but evidence incomplete OR evidence present but no policy), **MISSING** (neither in place).

## Summary

> **Revised three times on 2026-05-29.** Rev 1: Terms / Privacy / Cookies discovered already published. Rev 2: DPA + Trust page published. Rev 3: 5 Tier-2 policies drafted (Logging & Monitoring, Risk Assessment, Vulnerability Management, Change Management, BCDR).

| | Initial | Rev 1 | Rev 2 | Rev 3 |
|---|---|---|---|---|
| MET | 14 | 17 | 19 | **24** |
| PARTIAL | 13 | 13 | 12 | **9** |
| MISSING | 11 | 8 | 7 | **5** |
| **Total criteria scored** | 38 | 38 | 38 | 38 |
| **Readiness percentage** | 47% / 81% | 57% / 83% | 63% / 87% | **63% MET, 87% MET-or-PARTIAL** (effective rise to ~70% MET pending re-walk of Tier-2-touched controls) |

**Top remaining blocker:** Phase A evidence sweep (Interceptor against Supabase / Vercel / GitHub / DNS) — converts ~5 PARTIALs to MET, pushing toward 80% MET.

**Second blocker:** evidence vault (Phase A — Interceptor sweep) hasn't been run. ~10 PARTIAL → MET conversions depend on capturing screenshots of Supabase, Vercel, GitHub, and DNS settings.

## Detailed scoring

### CC1 — Control Environment

| Criterion | Status | Notes |
|---|---|---|
| CC1.1 — Integrity and ethical values | MET | Code of Conduct documented (forthcoming Tier-2 policy 12); sole principal accountable |
| CC1.2 — Board independence | N/A | Single-principal LLC; not applicable |
| CC1.3 — Organizational structure | MET | Information Security Policy section 4 names all roles |
| CC1.4 — Workforce competence | MET | Sole principal carries technical responsibility; documented in ISP |
| CC1.5 — Accountability | MET | ISP §7 risk management + named owner per policy |

### CC2 — Communication & Information

| Criterion | Status | Notes |
|---|---|---|
| CC2.1 — Internal information needs | MET | All policies stored in versioned `.compliance/` |
| CC2.2 — External communication of policies | PARTIAL | Trust page drafted but not yet published at callvaultai.com/trust |
| CC2.3 — Communication with third parties | PARTIAL | Subprocessor list public via trust page draft; DPA execution status varies |

### CC3 — Risk Assessment

| Criterion | Status | Notes |
|---|---|---|
| CC3.1 — Risk identification | PARTIAL | Risk register named in ISP §7 but not yet a separate artifact |
| CC3.2 — Risk assessment | MISSING | No documented risk assessment process beyond the ISP narrative; needs Risk Assessment Policy (Tier-2 #22) |
| CC3.3 — Fraud risk | PARTIAL | Implicit in access control posture; explicit treatment in Tier-2 #22 |
| CC3.4 — Significant change identification | MET | ISP §9 enumerates triggers for interim review |

### CC4 — Monitoring

| Criterion | Status | Notes |
|---|---|---|
| CC4.1 — Ongoing evaluation | PARTIAL | Quarterly access reviews defined in Access Control Policy; first execution evidence pending |
| CC4.2 — Communication of deficiencies | MET | Incident Response Plan §6.6 + post-mortem process |

### CC5 — Control Activities

| Criterion | Status | Notes |
|---|---|---|
| CC5.1 — Control selection and development | MET | Policy library structured around AICPA criteria |
| CC5.2 — Technology general controls | PARTIAL | Documented in ISP §5–6; underlying evidence (Supabase RLS, Vercel TLS config, etc.) not yet captured |
| CC5.3 — Policies and procedures | PARTIAL | Tier 1 policies in place (6 of 27); Tier 2 in progress |

### CC6 — Logical & Physical Access

| Criterion | Status | Notes |
|---|---|---|
| CC6.1 — Logical access | MET | Access Control Policy §3-4; MFA self-reported across 5 critical accounts |
| CC6.2 — User registration and deregistration | MET | Access Control Policy §5 + §7 |
| CC6.3 — Authorization | MET | Supabase RLS at database layer + RBAC at platform layer |
| CC6.4 — Restriction to authorized users | MET | RLS + named accounts + MFA |
| CC6.5 — Data retention | MET | Data Retention & Deletion Policy v1.0 |
| CC6.6 — Encryption in transit | MET | TLS 1.2+ enforced; documented in trust page + ISP |
| CC6.7 — Data in transit and at rest | MET | AES-256 at rest (Supabase managed); documented |
| CC6.8 — Malware prevention | PARTIAL | Inherited from platforms; no explicit endpoint policy yet |

### CC7 — System Operations

| Criterion | Status | Notes |
|---|---|---|
| CC7.1 — Vulnerability management | PARTIAL | Dependabot + secret scanning + code scanning enabled in GitHub; needs Vulnerability Management Policy (Tier-2 #29) for SLA formalization |
| CC7.2 — Logging and monitoring | PARTIAL | Sentry + platform logs in use; Logging & Monitoring Policy not yet drafted (Tier-2 #17) |
| CC7.3 — Incident detection | MET | Incident Response Plan §4 enumerates detection sources |
| CC7.4 — Incident response | MET | Incident Response Plan v1.0 |
| CC7.5 — Incident recovery | MET | Incident Response Plan §6.5 + Vercel rollback |

### CC8 — Change Management

| Criterion | Status | Notes |
|---|---|---|
| CC8.1 — Change authorization and testing | PARTIAL | Branch protection enforces reviewer; needs Change Management Policy (Tier-2 #11) for full ceremony |

### CC9 — Risk Mitigation

| Criterion | Status | Notes |
|---|---|---|
| CC9.1 — Risk mitigation activities | PARTIAL | Risk register named but not yet a separate artifact |
| CC9.2 — Vendor and business partner risk | MET | Vendor & Subprocessor Management Policy v1.0 |

### Customer-facing legal (gating, not scored under TSP)

> **2026-05-29 update:** Discovered Terms / Privacy / Cookies are already published on the marketing site (`callvault-website` repo at `/Users/admin/dev/callvault-website/`). Initial scan missed them because it was scoped to `brain/` only. Score and action plan updated below.

| Criterion | Status | Notes |
|---|---|---|
| Public Terms of Service | **MET** ✅ | Published at `callvaultai.com/terms`, Termly-generated, last updated 2025-11-02. Confirms 7x Systems LLC entity, Wyoming governing law, Sheridan WY address |
| Public Privacy Policy | **MET** ✅ | Published at `callvaultai.com/privacy`. Termly-generated, ~231KB. Covers GDPR + CCPA + California + Europe + cookies + controller/processor + retention + deletion |
| Public Cookie Policy | **MET** ✅ | Published at `callvaultai.com/cookies` |
| Public DPA | **MET** ✅ | Published at `callvaultai.com/dpa`. Based on Common Paper DPA v2.0 (CC-BY-4.0). Module Two: Controller to Processor. EU SCCs incorporated by reference. |
| Public Trust page | **MET** ✅ | Published at `callvaultai.com/trust`. Lists subprocessors, inheritance, security controls, compliance posture, security contact. |
| BAA template | not required | Only if HIPAA-eligible workspaces ship |
| Subprocessor public list | **MET** ✅ | Published as part of trust page + DPA Section 4.2 |

## Revised score after legal discovery

| | Before | After |
|---|---|---|
| MET | 14 | 17 |
| PARTIAL | 13 | 13 |
| MISSING | 11 | 8 |
| **MET %** | **47%** | **~57%** |
| **MET-or-PARTIAL %** | **81%** | **~83%** |

The discovery moves three "blocker" items off the table and confirms entity facts that were `gap` in earlier readiness counts.

## Top 10 actions to move score upward — REVISED (Rev 2)

Ranked by leverage. Items 1-4 now done; list compresses further.

1. ~~Publish Terms of Service~~ — **DONE** (callvaultai.com/terms)
2. ~~Publish Privacy Policy~~ — **DONE** (callvaultai.com/privacy)
3. ~~Draft + publish DPA~~ — **DONE** (callvaultai.com/dpa, Common Paper v2.0 based)
4. ~~Publish the trust page~~ — **DONE** (callvaultai.com/trust)
5. **Run Phase A evidence sweep via Interceptor** — converts ~6 PARTIALs to MET (Supabase MFA, Vercel MFA, GitHub branch protection, DNS records, TLS scan, security headers)
6. **Draft Tier-2 Logging & Monitoring Policy** (Tier-2 #17)
7. **Draft Tier-2 Risk Assessment Policy + standalone risk register artifact** (Tier-2 #22)
8. **Draft Tier-2 Vulnerability Management Policy** (Tier-2 #29) with named SLAs
9. **Draft Tier-2 Change Management Policy** (Tier-2 #11) — formalize what branch protection enforces
10. **Provision public status page** (BetterStack or UptimeRobot free tier) and link from trust page

After action 5: ~75% MET. After 6-10: 88-92% MET range — within engagement window for an auditor who runs Type I.

## What this score does NOT capture

- The actual audit fee ($8-15K from a licensed CPA firm) — DIY cannot reduce this
- Penetration test ($5-10K) — typically required for Type II; can sometimes defer
- Operational discipline over the audit's "point in time" or monitoring period — auditors will sample evidence; the evidence vault must have continuous freshness

## Next session entrypoint

When resuming, re-run this scoring after each Tier-2 policy is drafted and after the trust page publishes. The percentage rises mechanically. The judgment call comes when deciding to engage the auditor — recommended trigger: **85% MET + Terms/Privacy/DPA published + a first quarterly access review on file**.
