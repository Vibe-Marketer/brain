---
policy_id: WSP-023
title: Workstation Security Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.4", "CC6.7", "CC6.8"]
---

# Workstation Security Policy

## 1. Purpose

Defines the security configuration required of any workstation used to access CallVault production systems or customer data.

## 2. Scope

Every workforce-held device — laptop, desktop, or tablet — used to access:

- Supabase, Vercel, GitHub, Polar, Stripe, OpenRouter consoles
- CallVault source code
- 1Password vault containing CallVault credentials
- The principal's `@callvaultai.com` email

## 3. Minimum Configuration

| Control | Requirement | Verification |
|---------|-------------|--------------|
| Disk encryption | Required (FileVault on macOS, BitLocker on Windows, LUKS on Linux) | Quarterly check |
| Screen lock | Automatic after ≤ 5 minutes of inactivity | Quarterly check |
| OS updates | Auto-update enabled; major updates within 30 days of release | Quarterly check |
| Browser | Auto-update enabled | Quarterly check |
| Password / passcode | Required at login; sleep / lockscreen | Quarterly check |
| Firewall | OS-level firewall enabled (macOS Application Firewall, Windows Defender Firewall) | Quarterly check |
| Anti-malware | macOS built-in protection (Gatekeeper, XProtect, MRT) is the baseline; supplemental EDR is recommended but not currently required for the single-principal workstation | Quarterly check |
| Remote wipe capability | Find My (macOS), Find My Device (Windows), or MDM | Required for any device storing credentials |

## 4. Current State (as of 2026-05-29)

- **Primary workstation:** macOS (Darwin 25.x), FileVault enabled (verify quarterly), Find My enabled, screen lock active

## 5. Software Restrictions

- Software is installed only from trusted sources (App Store, vendor official sites)
- No personal browser extensions are installed on browser profiles used for production access (extensions can exfiltrate session cookies)
- A separate browser profile (or browser) for personal browsing vs production-access browsing is recommended

## 6. Mobile Device Management (MDM)

Not in use for the single-principal workforce. When the workforce expands to include employees or contractors with workstations accessing production, an MDM (Jamf, Kandji, Apple Business Essentials, or equivalent) will be deployed and this Policy updated.

## 7. Lost or Stolen Devices

Treated as a security event per the Incident Response Plan. Containment includes:

- Remote wipe via Find My or MDM
- Revocation of credentials accessible from the device
- Reset of active sessions on every production system

## 8. Review

Annual or on material change to the workforce composition or threat landscape.
