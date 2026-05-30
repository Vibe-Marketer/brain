---
policy_id: AMP-013
title: Asset Management Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC2.1", "CC5.2"]
---

# Asset Management Policy

## 1. Purpose

Defines how CallVault tracks the systems, infrastructure, code, and data assets that compose its production service.

## 2. Production System Inventory

| Asset | Owner | Purpose | Data Class processed |
|-------|-------|---------|----------------------|
| Supabase project (primary) | Andrew Naegele | Database (Postgres), Auth, Edge Functions, MCP server | Confidential — Customer Data |
| Vercel project (`brain`) | Andrew Naegele | React frontend, edge functions, CI/CD | Internal + Confidential metadata |
| GitHub `Vibe-Marketer/brain` | Andrew Naegele | Source code repository, CI workflows | Internal |
| `callvault-website` Vercel project | Andrew Naegele | Marketing site (`callvaultai.com`) + legal docs | Public |
| Domain registrar (Global Domain Group) | Andrew Naegele | DNS control for `callvaultai.com` | Restricted (DNS credentials) |
| Cloudflare account | Andrew Naegele | DNS management for `callvaultai.com` | Restricted (DNS credentials) |
| Polar account | Andrew Naegele | Subscription billing | Confidential (billing data) |
| Stripe (via Polar) | Andrew Naegele | Payment processor | Confidential (PCI scope on Stripe side) |
| OpenRouter account | Andrew Naegele | LLM routing | Restricted (API key) |
| Sentry organization | Andrew Naegele | Error monitoring | Internal + transient Confidential (stack traces) |
| 1Password vault | Andrew Naegele | Credential vault | Restricted |
| Google Workspace | Andrew Naegele | Email + calendar at `callvaultai.com` | Internal |

## 3. Workstation Inventory

| Device | OS | Owner | Disk encryption |
|--------|----|----|------------------|
| Primary development workstation (macOS) | macOS (Darwin 25.x) | Andrew Naegele | FileVault (verify quarterly) |

When workforce grows, each new workstation is added to this table along with named owner and encryption status. The Workstation Security Policy governs minimum configuration.

## 4. Data Asset Classes

Per the Data Classification Policy, CallVault recognizes four data classes:

- Public, Internal, Confidential — Customer Data, Restricted

Each asset above processes one or more classes; the highest class wins for control purposes.

## 5. Inventory Review

The asset inventory is reviewed at least annually and updated promptly when:

- A new production system is added or removed
- A subprocessor changes scope
- A new workforce workstation is provisioned

## 6. Asset Lifecycle

- **Provisioning** — new production accounts are created with named ownership, MFA enrollment, and recording in this Policy
- **Operation** — see relevant control policies (Access Control, Vulnerability Management, Logging & Monitoring)
- **Decommissioning** — when an asset is no longer needed, credentials are revoked and the asset is marked deprecated in this Policy; data is migrated or deleted per the Data Retention & Deletion Policy

## 7. Review

Annual or on material change.
