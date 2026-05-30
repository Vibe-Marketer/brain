---
policy_id: ACP-002
title: Access Control Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.1", "CC6.2", "CC6.3", "CC6.6", "CC6.7", "CC6.8"]
---

# Access Control Policy

## 1. Purpose

Establishes how access to CallVault production systems, source code, customer data, and supporting tools is provisioned, managed, reviewed, and revoked.

## 2. Scope

Applies to all human access (workforce, contractors) and machine access (service accounts, integrated AI clients via MCP) to:

- Supabase production project (database, Edge Functions, auth)
- Vercel production project
- GitHub `Vibe-Marketer/brain` repository
- Polar billing account, Stripe Connect account
- OpenRouter API account
- Domain registrar account
- Public DNS and email infrastructure

## 3. Identity and Authentication

### 3.1 Workforce identity

All workforce identities are linked to a unique, named user account on each system. Shared accounts are prohibited.

### 3.2 Multi-factor authentication (MFA)

MFA is **required** for the following accounts:

| Account | MFA status | Verification method |
|---------|-----------|---------------------|
| Supabase organization owner | Enabled | TOTP via authenticator app |
| Vercel team owner | Enabled | TOTP via authenticator app |
| GitHub organization owner | Enabled | TOTP + WebAuthn |
| Stripe account owner | Enabled | TOTP |
| Polar account owner | Enabled | TOTP |
| OpenRouter API account | Enabled | TOTP |
| Domain registrar | To be verified during quarterly access review |
| Personal email account of any principal | Required to be enabled by every principal |

Evidence of MFA enrollment is captured during quarterly access reviews and stored in the Evidence Vault.

### 3.3 Password management

Credentials for production systems are stored in **1Password** (primary). Legacy credentials previously stored in **LastPass** are being migrated to 1Password and any meaningful credentials have been rotated as part of the migration.

Browser-saved passwords are prohibited for production credentials.

### 3.4 Machine identity (MCP OAuth tokens)

Integrated AI clients (Claude.ai, ChatGPT, Cursor, custom MCP consumers) authenticate using either:

- **Legacy 64-character hex MCP tokens** issued via `app.callvaultai.com/settings/mcp`, each scoped to a specific organization and (optionally) workspace; or
- **Supabase OAuth JWTs** bound through the `mcp_oauth_org_bindings` table, issued via the `/oauth/consent` flow.

Both mechanisms enforce organization-level Row Level Security on every tool call. The full authorization boundary is documented in the MCP server source at `supabase/functions/mcp-server/auth.ts` and audited by the `category-gating.test.ts` and `write-tools-boundary.test.ts` test suites.

## 4. Authorization

### 4.1 Role-based access (production systems)

| System | Roles |
|--------|-------|
| Supabase | `organization_owner` (single principal) |
| Vercel | `team_owner` (single principal) |
| GitHub | `organization_owner` (single principal) |
| Polar | `account_owner` (single principal) |
| Stripe | `account_owner` (single principal) |
| OpenRouter | `account_owner` (single principal) |

Additional workforce members added in the future are granted least-privilege roles. Owner roles are reserved for principals.

### 4.2 Customer data authorization (in-product)

Customer data is protected at the database layer by Supabase Row Level Security policies. The policy surface enforces:

- A user can only see organizations they are a member of via `org_members`
- A user can only see workspaces within their organization
- A user can only see calls and transcripts within workspaces they have access to
- MCP token operations are scoped to the organization (and optionally workspace) declared on the token at issuance

RLS policy count, coverage, and last-modified evidence are captured during evidence sweeps.

## 5. Provisioning

New workforce access (when applicable) is provisioned only after:

1. A written engagement is in place (employment agreement or contractor SOW)
2. Acknowledgment of this Policy, the Acceptable Use Policy, and the Code of Conduct
3. Issuance of a named user account on each required system, configured with MFA before first use

## 6. Access Reviews

A **quarterly access review** is performed by the Information Security Officer. The review covers:

- Active named accounts on each production system
- MFA enrollment on each named account
- Inactive accounts (no login within 90 days) — flagged for revocation
- MCP tokens issued by customers — high-level audit of issuance volume; individual token contents are not reviewed unless a customer reports compromise
- Subprocessor access (any subprocessor representative with delegated access to CallVault systems is reviewed against the Subprocessor Management Policy)

Review evidence is recorded in the Evidence Vault under `.compliance/evidence/{YYYY-MM-DD}/access-review/`.

## 7. Revocation

Access is revoked immediately upon:

- Termination of engagement (workforce or contractor)
- Compromise of credentials (real or suspected)
- Violation of this Policy or the Acceptable Use Policy
- Customer-initiated MCP token revocation via the `app.callvaultai.com/settings/mcp` interface
- Customer-initiated OAuth grant revocation via the `mcp_oauth_org_bindings` table (customer-self-serve)

Revocation is verified within one business day by confirming the absence of active session tokens on the relevant system.

## 8. Audit Logging

All authentication events for production systems are logged by the underlying platforms (Supabase Auth logs, Vercel audit log, GitHub audit log, Stripe/Polar event logs). Log retention follows the Logging & Monitoring Policy.

## 9. Exceptions

Exceptions to this Policy require written approval from the Information Security Officer, documented justification, defined expiry, and entry into the risk register.

## 10. Review

This Policy is reviewed at least annually or upon material change.
