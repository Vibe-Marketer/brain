---
policy_id: DRP-004
title: Data Retention and Deletion Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.5", "CC6.7", "C1.2", "P4.1", "P4.2"]
---

# Data Retention and Deletion Policy

## 1. Purpose

Defines how long CallVault retains customer data, the mechanisms by which customers may request deletion, and the operational steps CallVault takes to honor those requests.

## 2. Scope

Applies to all customer data classified as **Confidential — Customer Data** in the Data Classification Policy, including transcripts, recordings metadata, contacts, organization and workspace records, AI-tool outputs, and customer account profile data.

## 3. Default Retention

As of the effective date, CallVault does **not** apply automatic time-based deletion to customer data. Customer-uploaded transcripts, derived AI outputs, contacts, and workspace records persist for the lifetime of the customer's account.

This default reflects the product's value proposition: CallVault is a long-term call intelligence vault. Customers expect data they ingest today to remain queryable years from now.

This default is documented honestly on the public trust page. Customers requiring time-bounded retention may either:

- Configure retention rules per workspace (where supported by the product), or
- Submit a deletion request as described in Section 4.

The current state of programmatic retention configuration is tracked in `.compliance/facts.yaml`. If automated retention becomes a customer-driven requirement, the configuration is documented here in a subsequent revision.

## 4. Customer-Initiated Deletion

Customers have three categories of self-serve deletion paths, all verified present in the CallVault application as of the effective date:

### 4.1 Account-level deletion

Available in the in-app **Settings → Account → Delete Account** flow, implemented in `src/components/settings/AccountTab.tsx`. The action permanently deletes the customer's account and cascades to all owned organizations, workspaces, calls, transcripts, contacts, AI outputs, MCP tokens, and OAuth grants.

### 4.2 Organization-level deletion

Available in the **Settings → Organizations → Delete Organization** flow, implemented in `src/components/dialogs/DeleteOrganizationDialog.tsx`. Deletion is gated by a confirmation step and cascades to all workspaces, calls, transcripts, contacts, and tokens scoped to the organization.

### 4.3 Workspace and call-level deletion

Workspace deletion is available in the per-workspace settings via `DeleteWorkspaceDialog.tsx`. Individual call deletion is available both in the UI and via the `delete_call` MCP tool (`supabase/functions/mcp-server/tools/write/delete_call.ts`).

### 4.4 Email-based deletion requests

Customers who prefer not to use self-serve mechanisms may email `support@callvaultai.com` requesting deletion. CallVault commits to:

- Acknowledge the request within **two business days**
- Complete the deletion within **thirty calendar days** of acknowledgment
- Send confirmation of completion to the requester

Deletion fulfillment is performed by the Information Security Officer or a delegate.

## 5. Subprocessor Propagation

Deletion of customer data within the CallVault Supabase project is the authoritative deletion event. Customer data propagated to subprocessors during normal operation has the following lifecycle:

| Subprocessor | Data propagated | Deletion behavior |
|--------------|-----------------|-------------------|
| Supabase | All customer data (primary storage) | Hard deleted by the cascading delete; subject to Supabase backup retention (up to 7 days for paid plans, longer for enterprise) |
| Vercel | Request logs, deployment metadata | Logs retained per Vercel's standard retention; do not include customer transcript content |
| Polar | Billing metadata, subscription state | Retained for tax and billing record-keeping per applicable law |
| Stripe | Payment metadata (via Polar) | Retained per Stripe's standard policy for payment records |
| OpenRouter / Anthropic / OpenAI | Transcript text transmitted at AI-tool invocation | These subprocessors maintain their own data retention policies. CallVault uses these providers under no-training conditions where contractually available; their published policies are linked from the public trust page. |

Customer deletion requests that require propagation beyond Supabase (e.g., requesting deletion of inputs previously submitted to a third-party LLM subprocessor) are forwarded by the Information Security Officer to the relevant subprocessor on a best-effort basis.

## 6. Backup Retention

CallVault relies on Supabase managed backups for disaster recovery. Backup contents are retained per the Supabase plan tier. Deleted customer data may persist in backup snapshots for the duration of the backup retention window.

Restoration of a backup that re-introduces deleted customer data requires explicit approval by the Information Security Officer and would itself be treated as a data event requiring customer notification.

## 7. Regulatory Compliance Posture

### 7.1 GDPR Article 17 (Right to Erasure)

CallVault provides the deletion mechanisms described in Section 4 in support of the right to erasure. CallVault's status as a controller versus processor is determined per customer agreement; for customers using CallVault to process personal data of third parties (e.g., call participants), CallVault acts as a processor and supports controller-initiated erasure via the same mechanisms.

### 7.2 CCPA / CPRA

CallVault honors verified consumer deletion requests submitted via `support@callvaultai.com` within the statutory window (currently 45 days plus a 45-day extension for complex cases).

### 7.3 HIPAA

CallVault does not currently market itself as a HIPAA-eligible service. Customers operating in healthcare-adjacent verticals who would treat call recordings as Protected Health Information are advised that CallVault is not configured for HIPAA workspaces at the effective date. The Subprocessor Management Policy notes which subprocessors offer Business Associate Agreements should HIPAA workspaces be introduced.

## 8. Verification

The presence of the deletion mechanisms in Section 4 is verified annually by:

- Running each deletion path against a test account
- Confirming the absence of the deleted data in the Supabase project after the deletion event
- Capturing evidence in `.compliance/evidence/{YYYY-MM-DD}/deletion-verification/`

## 9. Known Limitations

The following limitations are documented honestly as of the effective date and are subject to revision:

- **No published Terms of Service or Privacy Policy** at the effective date. Both are scheduled for publication before any enterprise sale. Until those documents are published, the deletion commitments above are made by this Policy and the trust page.
- **No automated retention scheduling** at the platform level. Retention is "indefinite by default" until a customer requests otherwise.
- **Backup window** during which deleted data may persist is the Supabase plan-tier default; CallVault does not currently override or extend this.

## 10. Review

This Policy is reviewed at least annually and upon any material change to the deletion mechanisms, subprocessor list, or applicable law.
