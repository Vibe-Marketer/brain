---
policy_id: PSP-019
title: Password Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.1", "CC6.2"]
---

# Password Policy

## 1. Purpose

Defines workforce password and authentication-factor expectations.

## 2. Scope

All workforce-held credentials for CallVault production systems and supporting platforms.

## 3. Authentication Factors

For every account with access to CallVault production systems, the workforce member MUST have at least one of:

- **Hardware-backed passkey** (preferred — phishing-resistant, FIDO2/WebAuthn)
- **TOTP authenticator app** (1Password, Authy, Google Authenticator, etc.)
- **Hardware security key** (YubiKey, etc.)

SMS-based 2FA is **discouraged** but tolerated for accounts that do not support stronger options. It is removed as soon as a stronger option becomes available.

## 4. Password Composition

For accounts that require a password in addition to a second factor:

- **Minimum 16 characters** when set or rotated after this Policy's effective date
- **Randomly generated** by 1Password or equivalent password manager — not human-chosen
- **Unique** per account — no reuse across services
- Must not appear in known-breach corpora (have-i-been-pwned check via 1Password Watchtower)

## 5. Credential Storage

- **1Password** is the primary credential vault
- **LastPass** is the legacy vault, deprecated; remaining items are being migrated to 1Password and any high-value credentials that ever lived in LastPass have been rotated (LastPass had a confirmed vault breach disclosed December 2022)
- Browser-saved passwords are prohibited for production credentials

## 6. Rotation

| Credential type | Rotation |
|-----------------|----------|
| Supabase service role key | Annually or on suspected compromise |
| Integration API keys (OpenRouter, Polar, Sentry, etc.) | Annually or on vendor advisory |
| Workforce personal passwords | On suspected compromise, role change, or termination; otherwise no fixed rotation (NIST SP 800-63B aligned — rotation requirements removed when MFA is in place) |
| Customer-issued MCP tokens | Customer-controlled at any time |

## 7. Suspected Compromise

A suspected credential compromise triggers immediate rotation and is treated as a security event per the Incident Response Plan.

## 8. MFA Coverage (state as of 2026-05-29)

Per the evidence sweep of 2026-05-29:

| Account | Native MFA | Effective MFA |
|---------|------------|---------------|
| GitHub (Vibe-Marketer org) | Enrolled (Passkey + GitHub Mobile + Recovery codes) | ✅ Strong |
| Supabase | 0 native authenticator apps configured | Inherited via GitHub OAuth — to be either directly enrolled OR documented as OAuth chain |
| Vercel | Passkey registered; TFA reported "Inactive" in UI | Passkey + GitHub OAuth — to either click Activate on the passkey TFA row OR add TOTP |
| Stripe | Self-reported enabled | Verification deferred to next sweep |
| Polar | Self-reported enabled | Verification deferred to next sweep |
| OpenRouter | Self-reported enabled | Verification deferred to next sweep |

The corrective action list is captured in `evidence/2026-05-29/FINDINGS.md` Findings F1 + F2.

## 9. Review

Annual or on material change to the authentication landscape.
