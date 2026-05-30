---
policy_id: HRP-016
title: HR Security Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC1.4", "CC1.5", "CC6.2", "CC6.3"]
---

# HR Security Policy

## 1. Purpose

Defines the security-related lifecycle for workforce members — onboarding, role changes, and offboarding.

## 2. Scope

All workforce members of 7x Systems LLC: principals, employees, and contractors with logical or physical access to CallVault production systems or customer data.

## 3. Current Workforce State

As of the effective date the workforce consists of a single principal (Andrew Naegele) who holds all production access. This Policy establishes the discipline that will apply as the workforce expands.

## 4. Onboarding

Before any new workforce member is granted access:

- A written engagement is executed (employment agreement or contractor SOW)
- The individual acknowledges (signed or written) the Information Security Policy, Acceptable Use Policy, and Code of Conduct
- A named account is provisioned on each required system (Supabase, Vercel, GitHub, etc.) with MFA enrolled before first use
- The individual completes initial security awareness training (per the Security Awareness Training Policy)
- The individual is added to the Asset Management Policy's Workstation Inventory if issued or using a workstation that accesses production

## 5. Background Checks

Background checks are not currently performed (single-principal company). When the workforce expands to include employees or contractors with access to Confidential — Customer Data:

- A standard background check (criminal records, employment verification, references) is conducted prior to access provisioning, where permitted by law
- Roles in regulated verticals (if pursued) may require additional checks per the applicable regulation

## 6. Role Changes

When a workforce member changes role:

- Access to systems no longer required for the new role is revoked within one business day
- Access to systems newly required for the new role is provisioned per the Access Control Policy
- The change is recorded in the quarterly access review

## 7. Offboarding

Within one business day of an engagement ending (voluntary or involuntary):

- Access to every CallVault production system is revoked
- Personal devices used to access CallVault are wiped of CallVault data or are subject to mobile device management remote wipe (when MDM is in place)
- Any company-issued device is recovered
- The individual is removed from named-user lists in Asset Management
- Email forwarding from the individual's `@callvaultai.com` address is configured per Customer Communication Policy (forthcoming) or the alias is retired

## 8. Confidentiality

All workforce members are bound by confidentiality obligations regarding customer data, security incidents, unreleased product work, and 7x Systems LLC business affairs. Confidentiality obligations survive termination of engagement.

## 9. Training

- All workforce members complete annual security awareness training per the Security Awareness Training Policy
- New hires complete initial training within 30 days of access provisioning

## 10. Review

Annual or on material change to workforce composition.
