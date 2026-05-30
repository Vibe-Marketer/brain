---
policy_id: PSP-020
title: Physical Security Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.4", "CC6.5"]
---

# Physical Security Policy

## 1. Purpose

Defines the physical security posture for CallVault. Minimal applicability — CallVault is a remote-only company with no physical office and no on-premise infrastructure.

## 2. Office

7x Systems LLC has no physical office. The registered address (`1309 Coffeen Ave, Ste 17642, Sheridan, WY 82801`) is a registered-agent address, not an operational location.

## 3. Data Center Inheritance

CallVault's physical data center controls are entirely inherited from its subprocessors:

- **Supabase** — physical access controls at the underlying cloud-provider data centers, audited under Supabase's SOC 2 Type II
- **Vercel** — physical access controls at the underlying cloud-provider data centers, audited under Vercel's SOC 2 Type II + ISO 27001:2022

Independent verification: see each provider's public trust documentation linked from `callvaultai.com/trust`.

## 4. Workstation Physical Security

For the single principal's workstation:

- The device is kept in a physically secured personal residence
- FileVault disk encryption is enabled
- Auto-lock after inactivity is enabled
- Workstation is never left logged-in in public

When the workforce expands, equivalent controls are required on every workstation; the Workstation Security Policy enumerates the configuration.

## 5. Loss or Theft

Suspected loss or theft of a workstation that may contain CallVault credentials or customer data is treated as a security event per the Incident Response Plan. Containment includes:

- Immediate revocation of credentials stored or accessible from the device
- Remote wipe via Find My (macOS) if available
- Reset of any active sessions on production systems

## 6. Review

Annual or when CallVault acquires physical infrastructure (no plan to do so at the current stage).
