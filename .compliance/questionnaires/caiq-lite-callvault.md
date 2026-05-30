---
title: CallVault CAIQ-Lite response
version: v1 (initial fill)
based_on: Cloud Security Alliance Cloud Controls Matrix (CCM) v4.0 — Lite subset
status: draft for review
last_updated: 2026-05-29
respondent: Andrew Naegele, Principal, 7X Systems LLC
contact: support@callvaultai.com
---

# CallVault CAIQ-Lite Response

> Pre-filled response covering the most-asked control families. Send to prospective customers on request, with `[Security Review]` subject line, from `support@callvaultai.com`.
> Format: `[YES | NO | N/A | SEE NOTE]` + brief evidence/notes.

---

## Company & contact

| Field | Response |
|---|---|
| Legal entity | 7x Systems LLC (d/b/a CallVault) |
| State of formation | Wyoming, United States |
| Registered address | 1309 Coffeen Ave, Ste 17642, Sheridan, WY 82801 |
| Phone | +1 307-218-2437 |
| Product | CallVault |
| Customer contact | support@callvaultai.com |
| Security contact | support@callvaultai.com |
| Terms of Service | https://callvaultai.com/terms (last updated 2025-11-02) |
| Privacy Policy | https://callvaultai.com/privacy |
| Cookie Policy | https://callvaultai.com/cookies |
| Trust page | callvaultai.com/trust (in progress) |
| Workforce size with system access | 1 (sole principal) |

---

## 1. Application & Interface Security (AIS)

| # | Question | Response | Notes |
|---|---|---|---|
| AIS-01 | Do you use industry-standard secure coding practices? | YES | TypeScript strict mode, ESLint, code review on every PR, dependency scanning via Dependabot |
| AIS-02 | Are application boundaries and inputs validated server-side? | YES | All inputs validated at Edge Function boundary; Zod schemas on critical paths; RLS enforced at the database |
| AIS-03 | Are interfaces tested for OWASP Top 10 issues? | SEE NOTE | Static analysis via TypeScript + ESLint; no formal pentest yet (planned alongside SOC 2 Type II) |
| AIS-04 | Are customers notified of API changes? | YES | MCP protocol version `2024-11-05`; breaking changes versioned and announced |

## 2. Audit Assurance & Compliance (AAC)

| # | Question | Response | Notes |
|---|---|---|---|
| AAC-01 | Do you hold a current SOC 2 attestation? | NO | In preparation; external audit planned for 2026 |
| AAC-02 | Do you hold ISO 27001 certification? | NO | Not currently pursued |
| AAC-03 | Do you inherit attestations from infrastructure providers? | YES | Supabase (SOC 2 Type II, HIPAA-eligible), Vercel (SOC 2 Type II, ISO 27001:2022, EU-US DPF) — disclosed publicly on trust page |
| AAC-04 | Are internal audits performed? | YES | Quarterly access reviews; annual subprocessor reviews; annual policy reviews |
| AAC-05 | Will you make audit reports available under NDA? | YES | On request once SOC 2 attestation is in hand |

## 3. Business Continuity Management & Operational Resilience (BCR)

| # | Question | Response | Notes |
|---|---|---|---|
| BCR-01 | Is a Business Continuity / DR plan documented? | YES | BCDR Policy (in policy library) |
| BCR-02 | Are backups encrypted? | YES | Supabase managed backups; AES-256 at rest |
| BCR-03 | Has backup restore been tested? | YES | Restore exercised at least once; result confirmed |
| BCR-04 | Is RTO/RPO defined? | SEE NOTE | Inherited from Supabase plan tier; specific targets being formalized |
| BCR-05 | Is service availability target documented? | YES | 99.5% monthly availability target, derived from underlying Supabase + Vercel SLAs |

## 4. Change Control & Configuration Management (CCC)

| # | Question | Response | Notes |
|---|---|---|---|
| CCC-01 | Is production change subject to formal review? | YES | GitHub branch protection on `main` requires reviewer approval before merge |
| CCC-02 | Are changes tested before production? | YES | Automated test suite (vitest); npm run build gating; manual QA on critical UI changes |
| CCC-03 | Is rollback supported? | YES | Vercel instant rollback to any prior deployment |
| CCC-04 | Are emergency change procedures documented? | YES | Same review pathway; hotfix branches reviewed before merge |
| CCC-05 | Is a separate non-production environment used for testing? | YES | Local development environment + Vercel preview deployments per PR |

## 5. Data Security & Information Lifecycle Management (DSI)

| # | Question | Response | Notes |
|---|---|---|---|
| DSI-01 | Is customer data classified? | YES | Data Classification Policy defines four classes; customer data is Confidential |
| DSI-02 | Is data encrypted at rest? | YES | Supabase managed AES-256 |
| DSI-03 | Is data encrypted in transit? | YES | TLS 1.2+ on all public endpoints |
| DSI-04 | Can customers export their data? | YES | MCP read tools support export; full schema documented |
| DSI-05 | Can customers delete their data? | YES | Self-serve at account/org/workspace/per-call; also via email request to support@callvaultai.com |
| DSI-06 | What is the data retention default? | SEE NOTE | Indefinite (lifetime of account) by default; customer-controllable; deletion mechanisms above |
| DSI-07 | Is data segregated between customers? | YES | Row Level Security policies enforce per-organization scoping at the database layer |
| DSI-08 | Are data flows documented? | YES | Documented in Information Security Policy and Subprocessor list |

## 6. Datacenter Security (DCS)

| # | Question | Response | Notes |
|---|---|---|---|
| DCS-01 | Where is the data center located? | SEE NOTE | Supabase + Vercel managed; CallVault inherits their physical security controls |
| DCS-02 | Are physical access controls in place at the data center? | YES | Inherited from Supabase and Vercel; reference their SOC 2 reports |
| DCS-03 | Is the data center compliant with relevant physical security standards? | YES | Supabase data centers are SOC 2 Type II audited; Vercel is SOC 2 Type II + ISO 27001:2022 audited |

## 7. Encryption & Key Management (EKM)

| # | Question | Response | Notes |
|---|---|---|---|
| EKM-01 | Is encryption applied to customer data at rest? | YES | AES-256 via Supabase |
| EKM-02 | Is encryption applied to customer data in transit? | YES | TLS 1.2+ |
| EKM-03 | Are encryption keys managed by the provider? | YES | Supabase + Vercel manage their respective platform keys |
| EKM-04 | Is customer-managed key (CMK) supported? | NO | Not at current stage; on roadmap consideration if customer demand emerges |
| EKM-05 | Are TLS certificates managed and rotated? | YES | Automated via Vercel |

## 8. Governance & Risk Management (GRM)

| # | Question | Response | Notes |
|---|---|---|---|
| GRM-01 | Is a written Information Security Policy in place? | YES | Information Security Policy v1.0, effective 2026-05-29 |
| GRM-02 | Is a risk assessment process documented? | YES | Risk Assessment Policy; risk register maintained |
| GRM-03 | Are policies reviewed annually? | YES | All policies have a `next_review_due` and named owner |
| GRM-04 | Is a designated Information Security Officer named? | YES | Andrew Naegele (sole principal at current scale) |

## 9. Human Resources Security (HRS)

| # | Question | Response | Notes |
|---|---|---|---|
| HRS-01 | Are background checks performed on workforce with system access? | N/A | Single-principal company; not currently applicable |
| HRS-02 | Are workforce members trained on security awareness? | YES | Self-administered annual review by the principal |
| HRS-03 | Are workforce members required to sign acceptable use agreements? | YES | Acceptable Use Policy acknowledged by the principal |
| HRS-04 | Are termination procedures defined? | YES | HR Security Policy defines offboarding for future workforce growth |

## 10. Identity & Access Management (IAM)

| # | Question | Response | Notes |
|---|---|---|---|
| IAM-01 | Is multi-factor authentication required for administrative access? | YES | Enforced on Supabase, Vercel, GitHub, Stripe, Polar, OpenRouter |
| IAM-02 | Is least-privilege access enforced? | YES | RBAC at platform level; RLS at database level |
| IAM-03 | Are user accounts unique and traceable? | YES | Named accounts on every production system; no shared accounts |
| IAM-04 | Are access reviews performed? | YES | Quarterly access reviews per Access Control Policy |
| IAM-05 | Is access revoked promptly on role change or termination? | YES | Within one business day per Access Control Policy |
| IAM-06 | Is a password manager used for credentials? | YES | 1Password (primary); legacy LastPass material is being migrated |
| IAM-07 | Is SSO supported for customer authentication? | NO | Supabase Auth password + magic link + Google OAuth supported; SAML SSO on enterprise roadmap |

## 11. Infrastructure & Virtualization Security (IVS)

| # | Question | Response | Notes |
|---|---|---|---|
| IVS-01 | Is infrastructure managed by a reputable provider? | YES | Supabase, Vercel |
| IVS-02 | Are network segmentation controls in place? | YES | Supabase project boundary; Vercel deployment isolation; CallVault does not host on shared customer infrastructure |
| IVS-03 | Are firewall rules documented? | SEE NOTE | Vercel default firewall posture; no custom rules required at current scale |
| IVS-04 | Is vulnerability scanning performed? | YES | GitHub Dependabot, secret scanning, code scanning enabled |
| IVS-05 | Are critical patches applied promptly? | YES | Dependabot PRs reviewed and merged on a regular cadence |

## 12. Logging & Monitoring (LOG)

| # | Question | Response | Notes |
|---|---|---|---|
| LOG-01 | Are administrative actions logged? | YES | Supabase Auth logs, Vercel audit log, GitHub audit log |
| LOG-02 | Are MCP tool calls logged? | YES | Every call logged with org, tool, outcome |
| LOG-03 | How long are logs retained? | SEE NOTE | Per platform defaults; Logging & Monitoring Policy formalizes targets |
| LOG-04 | Is centralized log review performed? | YES | Sentry for application errors; Supabase/Vercel/GitHub dashboards reviewed quarterly |
| LOG-05 | Are alerts configured for anomalous activity? | YES | Sentry alerts on production errors |

## 13. Mobile Security (MOS)

| # | Question | Response | Notes |
|---|---|---|---|
| MOS-01 | Is a mobile device management (MDM) solution in use? | NO | Single-principal, remote-only; not currently applicable |
| MOS-02 | Is disk encryption enforced on workforce devices? | YES | FileVault on macOS (the primary workstation OS) |

## 14. Security Incident Management (SEF)

| # | Question | Response | Notes |
|---|---|---|---|
| SEF-01 | Is an Incident Response Plan documented? | YES | Incident Response Plan v1.0, effective 2026-05-29 |
| SEF-02 | Are customers notified of incidents affecting them? | YES | Notification windows per Incident Response Plan and applicable law |
| SEF-03 | Have there been any reportable incidents in the last 12 months? | NO | None reported |
| SEF-04 | Are post-mortems performed for material incidents? | YES | Written post-mortem within two weeks of incident closure |

## 15. Supply Chain Management, Transparency & Accountability (STA)

| # | Question | Response | Notes |
|---|---|---|---|
| STA-01 | Are subprocessors disclosed publicly? | YES | callvaultai.com/trust |
| STA-02 | Are DPAs in place with subprocessors? | SEE NOTE | DPA execution status varies; reviewed annually per Subprocessor Management Policy |
| STA-03 | Are customers notified of subprocessor changes? | YES | At least 15 days advance notice for material additions |
| STA-04 | Are subprocessor security postures reviewed? | YES | Annual review per Subprocessor Management Policy |

## 16. Threat & Vulnerability Management (TVM)

| # | Question | Response | Notes |
|---|---|---|---|
| TVM-01 | Is vulnerability scanning performed? | YES | GitHub Dependabot, secret scanning, code scanning |
| TVM-02 | Are critical vulnerabilities remediated promptly? | YES | Vulnerability Management Policy defines SLAs by severity |
| TVM-03 | Is penetration testing performed? | NO | Not at current stage; planned alongside SOC 2 Type II |
| TVM-04 | Are bug bounty / responsible disclosure programs in place? | YES | Responsible disclosure via support@callvaultai.com |

---

## Notes for the recipient

1. CallVault is in active preparation for SOC 2 Type I. This response represents our honest current state, not aspirational claims.
2. Where this response cites a policy, the policy is available on request under NDA.
3. The respondent (Andrew Naegele) is reachable at `support@callvaultai.com` for follow-up questions.
4. We commit to update this CAIQ response within 30 days of any material change to our security posture.

---

*Last updated 2026-05-29 — refreshed on material change or at minimum quarterly.*
