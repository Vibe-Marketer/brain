---
policy_id: SSP-022
title: Supplier Security Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC9.2"]
notes: "Complements the Vendor and Subprocessor Management Policy (#6). #6 covers vendors that process customer data; this Policy covers operational suppliers that don't."
---

# Supplier Security Policy

## 1. Purpose

Defines how CallVault evaluates and engages **supporting vendors** — third parties material to operations that do **not** process customer data.

## 2. Distinction from Subprocessors

| Category | Policy | Examples |
|----------|--------|----------|
| **Subprocessor** | Vendor & Subprocessor Management Policy (#6) | Supabase, Vercel, Polar, Stripe, OpenRouter, Anthropic, OpenAI |
| **Supplier** | This Policy | 1Password, GitHub, Sentry, Cloudflare, domain registrar, Google Workspace |

## 3. Supplier Inventory

| Supplier | Role | Material to availability or security |
|----------|------|---------------------------------------|
| GitHub | Source code hosting, CI/CD, audit log | Yes — loss would lose source code and CI history |
| 1Password | Credential vault | Yes — loss would lock the principal out of every credential |
| Sentry | Error monitoring | Moderate — loss would degrade incident detection |
| Cloudflare | DNS for `callvaultai.com` | Yes — loss would interrupt DNS resolution |
| Global Domain Group | Domain registrar | Yes — loss of access could lead to domain hijack |
| Google Workspace | Email, calendar | Yes — `support@callvaultai.com` is the customer-facing inbox |

## 4. Selection Criteria

Before engaging a new supplier:

1. Necessity — does the supplier materially improve operations or reduce a risk that cannot be addressed in-house?
2. Posture — does the supplier maintain a security posture appropriate to the access they will be granted (account, vault contents, DNS records, source code)?
3. Authentication — does the supplier support MFA and (preferably) hardware-backed authentication?
4. Audit trail — does the supplier expose an audit log for the access activity that matters (account changes, login events)?
5. Exit terms — can CallVault offboard without losing the asset the supplier holds?

## 5. Engagement

For a new supplier:

- Account is provisioned with named ownership (principal as of effective date)
- MFA is enrolled before first use
- Account credentials are stored in 1Password
- Supplier is added to this Policy's inventory in Section 3

## 6. Ongoing Review

- **Annually**, the Information Security Officer reviews each supplier:
  - Account remains in good standing
  - MFA is still enabled
  - Vendor's security posture has not materially degraded
  - Whether the supplier is still required

Review evidence: `.compliance/evidence/{YYYY-MM-DD}/supplier-review/`.

## 7. Termination

When a supplier is no longer required:

- Credentials are revoked
- Data held by the supplier is migrated or deleted
- The supplier is marked deprecated in this Policy

## 8. Review

Annual or on material supplier change.
