---
policy_id: DCP-003
title: Data Classification Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.1", "C1.1", "C1.2"]
---

# Data Classification Policy

## 1. Purpose

Defines how CallVault classifies the data it handles, the handling requirements for each class, and the labeling and storage rules that apply.

## 2. Data Classes

CallVault recognizes four data classes.

### 2.1 Public

Data intentionally made available to the public.

**Examples:** marketing-site content, the public trust page at `callvaultai.com/trust`, public-facing API documentation, open-source code.

**Handling:** no restriction. May be distributed freely.

### 2.2 Internal

Operational data of 7X Systems LLC that is not customer data and is not intended for public release.

**Examples:** internal product roadmap, internal planning notes in `.planning/`, infrastructure configuration, this policy library.

**Handling:** stored in the private GitHub repository or in 1Password. Shared only with workforce members on a need-to-know basis.

### 2.3 Confidential — Customer Data

Data provided by, or generated on behalf of, customers using CallVault.

**Examples (non-exhaustive):**

- Call recordings (audio files referenced by CallVault but typically hosted at the originating meeting platform — e.g., Fathom, Zoom)
- Transcript text in the `transcripts` and `transcript_segments` tables
- Speaker identification and metadata in `call_speakers` and `call_participants`
- Contact records in `contacts`
- AI-tool outputs derived from customer transcripts (action items, summaries, sentiment, coaching notes)
- Customer organization / workspace / membership metadata
- Customer email addresses, names, and authentication identifiers
- Customer-issued MCP tokens and OAuth grant records

**Handling:**

- **Storage** — Supabase managed Postgres with encryption at rest enabled by the platform; access protected by Row Level Security enforcing organization and workspace scoping.
- **Transit** — TLS 1.2 or higher for all network access. Plaintext HTTP is not permitted for any production endpoint.
- **Access** — granted only via authenticated sessions (customer login) or scoped MCP tokens/OAuth grants. No broad-access service accounts read customer data.
- **Logging** — every MCP tool call is logged with customer organization, tool name, and outcome. Logs do not include customer transcript content unless required for an active incident investigation.
- **Retention and deletion** — governed by the Data Retention & Deletion Policy.
- **Disclosure** — never to third parties except subprocessors necessary to deliver the service, listed publicly on the trust page.

### 2.4 Restricted — Authentication and Secrets

Materials whose disclosure would directly compromise access to CallVault systems or customer data.

**Examples:**

- Production Supabase service role keys
- Vercel environment variable contents
- Polar / Stripe API keys
- OpenRouter API keys
- DNS and registrar credentials
- 1Password vault master password
- Personal recovery codes for any administrative account

**Handling:**

- **Storage** — exclusively in 1Password vaults or in environment variable stores provided by the hosting platforms (Vercel, Supabase, GitHub Actions secrets). Never in source code, repository files, planning documents, or chat transcripts.
- **Access** — restricted to principals.
- **Rotation** — required immediately upon suspected disclosure; otherwise on a defined schedule (Supabase service role: annually; integration API keys: annually or at vendor request).
- **Transmission** — secret material is never transmitted by email or chat. Sharing within the workforce uses 1Password's sharing facility.

## 3. Labeling

Where practical, files and tables are labeled with their data class. The default labeling rules are:

- All data stored in the production Supabase project is treated as **Confidential — Customer Data** unless explicitly noted otherwise (e.g., system metadata tables).
- All files in `.compliance/` are treated as **Internal**.
- All files under `.env`, `.env.local`, and environment variable stores are treated as **Restricted**.
- All published content under the marketing site or `callvaultai.com/trust` is **Public**.

## 4. Handling Matrix

| Class | Encryption in transit | Encryption at rest | Backup | Access logging | Retention default |
|-------|-----------------------|--------------------|--------|----------------|-------------------|
| Public | Recommended | Not required | N/A | Not required | N/A |
| Internal | Required | Recommended | Git history | Recommended | Indefinite |
| Confidential — Customer | Required | Required | Required | Required | Per Data Retention Policy |
| Restricted | Required | Required | Required (1Password vault backup) | Required | Until rotation |

## 5. Special Considerations

### 5.1 AI-tool outputs

When a customer invokes an AI-tier MCP tool (`ask_call`, `extract_action_items`, `get_sentiment`, `get_coaching_notes`), the source transcript text is transmitted to OpenRouter, which routes to Anthropic or OpenAI per request. The transit is over TLS to a named subprocessor, and the data class remains **Confidential — Customer Data** through the entire flow. Customers who do not invoke AI tools never have their transcripts transmitted to LLM subprocessors.

### 5.2 Aggregated and anonymized data

CallVault does not currently maintain aggregated or anonymized datasets derived from customer data. Should this change, the resulting dataset is treated as **Confidential — Customer Data** unless the anonymization process is documented and reviewed to meet the definition of anonymous data under GDPR Recital 26.

## 6. Review

This Policy is reviewed at least annually and upon material change to the CallVault data model.
