---
policy_id: ISP-001
title: Information Security Policy
owner: Andrew Naegele
approver: Andrew Naegele (sole principal, 7X Systems LLC)
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
status: active
references:
  - AICPA TSP Section 100 (Trust Services Criteria)
  - NIST SP 800-53 Rev 5
  - ISO/IEC 27001:2022 Annex A
---

# Information Security Policy

## 1. Purpose

This Information Security Policy ("Policy") establishes the security framework for **CallVault** (a product of **7X Systems LLC**, a Wyoming limited liability company). It defines the principles, responsibilities, and controls used to safeguard the confidentiality, integrity, and availability ("CIA") of customer data, company data, and the systems that process them.

This Policy is the master document. All other CallVault security policies derive from and must be consistent with it.

## 2. Scope

This Policy applies to:

- **All CallVault production systems**: the React application, Supabase project (database + Edge Functions + authentication), Vercel-hosted frontend, MCP server endpoints at `api.callvaultai.com`, and any infrastructure used to deliver the CallVault service to customers.
- **All workforce members**: principals, employees, contractors, and any third party with logical or physical access to CallVault systems or data. At the effective date, the workforce consists of one principal (Andrew Naegele).
- **All customer data** ingested, processed, stored, or transmitted by CallVault, including call recordings, transcripts, contacts, account credentials, and derived AI outputs.
- **All subprocessors** engaged by CallVault to deliver the service: Supabase, Vercel, Polar, Stripe, OpenRouter, Anthropic, and OpenAI as of the effective date. The current subprocessor list is maintained in the Subprocessor Management Policy and on the public trust page at `callvaultai.com/trust`.

## 3. Information Security Objectives

7X Systems LLC commits to the following objectives, measured annually:

| Objective | Target |
|-----------|--------|
| Customer data confidentiality | Zero unauthorized disclosures of customer call recordings, transcripts, or contact data |
| System availability | 99.5% monthly uptime for the production CallVault API and frontend (inherited from underlying Supabase + Vercel SLAs) |
| Change integrity | 100% of production code changes reviewed and approved before merge to `main` |
| Backup recoverability | Successful annual restore test from Supabase managed backups |
| Subprocessor accountability | Annual review of all subprocessors against this Policy and the Vendor Management Policy |

## 4. Roles and Responsibilities

**Andrew Naegele** is the sole principal of 7X Systems LLC and currently holds all of the following roles. As the workforce grows, these roles will be allocated to distinct individuals.

| Role | Responsibilities |
|------|------------------|
| **Information Security Officer (ISO)** | Owns this Policy, all derivative policies, the risk register, and the annual security review |
| **System Administrator** | Operates production Supabase, Vercel, GitHub, Polar, Stripe, and OpenRouter accounts |
| **Incident Response Lead** | First responder for any security event; coordinates remediation and customer notification per the Incident Response Plan |
| **Data Protection Officer (DPO)** | Responsible for GDPR/CCPA inquiries, customer data deletion requests, and subprocessor data flows |
| **Privacy Contact** | Receives privacy and security inquiries at `support@callvaultai.com` |

## 5. Information Security Principles

CallVault operates under the following principles. Every control described in this Policy or its derivatives traces back to one or more of these.

1. **Least privilege.** Workforce members, customers, and integrated AI clients receive only the access required for their function. Default-deny is the design posture for both code (Supabase RLS) and operational tooling.
2. **Defense in depth.** No single control is treated as sufficient. Customer data is protected by network isolation (Supabase project boundaries), authentication (Supabase Auth + MFA), authorization (Row Level Security per organization and workspace), encryption in transit (TLS 1.2+) and at rest (Supabase/Vercel managed encryption), and access logging.
3. **Data minimization.** CallVault collects only the customer data required to deliver its core service. AI inferences over customer data are performed by named subprocessors only when the customer explicitly invokes an AI-tier MCP tool.
4. **Subprocessor inheritance with documentation.** Where CallVault relies on a subprocessor's controls (e.g., Supabase SOC 2 Type II, Vercel ISO 27001), the inheritance is explicit and disclosed in this Policy, the Subprocessor Management Policy, and the public trust page.
5. **Transparency over secrecy.** CallVault discloses its security posture, subprocessor list, and known limitations publicly. The trust page exists so prospective customers can evaluate CallVault without filing a request.
6. **Continuous improvement.** This Policy and its derivatives are reviewed at least annually. Material changes — to architecture, subprocessors, workforce, or regulatory exposure — trigger interim review.

## 6. Control Domains

CallVault organizes security controls into the following domains. Each domain is governed by a derivative policy (titled in parentheses).

| Domain | Governing policy |
|--------|------------------|
| Logical access | Access Control Policy |
| Data classification and handling | Data Classification Policy |
| Data retention and deletion | Data Retention & Deletion Policy |
| Cryptography in transit and at rest | Encryption Policy |
| Change management and secure development | Secure Development Policy, Change Management Policy |
| Vulnerability management | Vulnerability Management Policy |
| Logging and monitoring | Logging & Monitoring Policy |
| Backup and disaster recovery | Business Continuity / DR Policy |
| Incident response | Incident Response Plan |
| Subprocessor / vendor management | Vendor Management Policy, Subprocessor Management Policy |
| Workstation security | Workstation Security Policy |
| Risk assessment | Risk Assessment Policy |
| HR security (onboarding/offboarding) | HR Security Policy |
| Physical security | Physical Security Policy (remote-only; minimal applicability) |
| Asset management | Asset Management Policy |
| Acceptable use | Acceptable Use Policy |
| Awareness and training | Security Awareness Training Policy |

## 7. Risk Management

7X Systems LLC maintains a risk register documenting identified information security risks, their assessed impact and likelihood, and the controls or accepted-risk decisions applied to each. The risk register is reviewed by the ISO at least annually and on any material change.

Known accepted risks as of the effective date:

- **No cyber liability insurance** is in force. The principal has reviewed and accepted this risk in light of company stage, revenue, and the absence of contractual customer obligations requiring coverage. This decision is revisited annually or upon execution of the first enterprise customer agreement.
- **Single principal** holds all production access. Bus-factor risk is acknowledged. Mitigation: documented credential recovery procedure stored in 1Password emergency kit, and a documented business-continuity playbook in the BCDR Policy.
- **LastPass legacy vault** is in the process of being migrated to 1Password and the principal has rotated any credentials of meaningful value that ever lived in LastPass.

## 8. Policy Compliance

All workforce members are required to comply with this Policy and all derivative policies. Material non-compliance is grounds for revocation of access and, where applicable, termination of engagement.

## 9. Policy Review

This Policy is reviewed at least annually by the Information Security Officer. The next scheduled review is **2027-05-29**.

Material events that trigger an interim review include:

- Addition or removal of any subprocessor processing customer data
- Addition of any workforce member with production access
- Any security-relevant incident as defined in the Incident Response Plan
- Material change to the CallVault architecture, including transport, authentication, or data residency
- Material change to the regulatory environment (e.g., enactment of a new privacy law affecting CallVault customers)

## 10. Approval

| | |
|---|---|
| Approved by | Andrew Naegele, Principal, 7X Systems LLC |
| Effective date | 2026-05-29 |
| Version | 1.0 |
