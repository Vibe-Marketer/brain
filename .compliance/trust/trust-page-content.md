---
title: Trust page — content draft
target_url: callvaultai.com/trust
status: draft for review
last_updated: 2026-05-29
---

# CallVault Trust

> Source content for the public trust page at `callvaultai.com/trust`. Render in the marketing site framework; deliver static.

---

## Hero

**CallVault is built on a foundation of trusted infrastructure and a default-secure architecture.**

We're 7x Systems LLC, a Wyoming-registered limited liability company operating CallVault — the long-term call intelligence vault for revenue teams who need their conversation history to stay queryable, secure, and theirs.

Headquartered at 1309 Coffeen Ave, Ste 17642, Sheridan, WY 82801. Contact: `support@callvaultai.com` or +1 307-218-2437.

This page documents how we handle customer data, who processes it on our behalf, and how to reach us with security questions.

---

## At a glance

| | |
|---|---|
| Encryption in transit | TLS 1.2+ on every CallVault endpoint |
| Encryption at rest | AES-256 (Supabase managed) |
| Data isolation | Row-level security per organization and workspace, enforced at the database layer |
| Authentication | MFA enforced on all CallVault production admin accounts |
| Audit logging | Every MCP tool call logged with organization, tool, and outcome |
| Customer-controlled deletion | Self-serve at account, organization, workspace, and per-call level |
| Security contact | `support@callvaultai.com` — 5 business day response target |

---

## Certifications and inheritance

CallVault is a Wyoming LLC operated by a single principal as of May 2026. We are not currently SOC 2 attested. We are in the active preparation phase for SOC 2 Type I and expect to engage an external auditor in 2026.

While we work toward attestation, the infrastructure CallVault runs on is independently audited. Our customers inherit material coverage from the following providers:

| Provider | Role at CallVault | Independent attestations |
|---|---|---|
| [Supabase](https://supabase.com/trust) | Database, authentication, Edge Functions | SOC 2 Type II, HIPAA-eligible plans, GDPR DPA available |
| [Vercel](https://vercel.com/legal/dpa) | Frontend hosting, edge functions, CI/CD | SOC 2 Type II, ISO 27001:2022, HIPAA BAA on Enterprise plan, EU-US Data Privacy Framework certified |
| [Stripe](https://stripe.com/legal/privacy-center) (via Polar) | Payment processing | PCI DSS Level 1, SOC 1 & 2 Type 2, ISO 27001, EU-US DPF |
| [Anthropic](https://trust.anthropic.com) | AI inference (via OpenRouter, on customer invocation only) | SOC 2 Type II, HIPAA BAA available, ISO 27001 |
| [OpenAI](https://trust.openai.com) | AI inference (via OpenRouter, on customer invocation only) | SOC 2 Type II, CSA STAR Level 1, HIPAA BAA available |

Inheritance is not the same as attestation, and we don't claim otherwise. The cells above link to each provider's public trust documentation so you can verify directly.

---

## Subprocessors

A subprocessor is a third party that processes customer data on CallVault's behalf. The current list:

| Subprocessor | Purpose | Region | Customer data processed |
|---|---|---|---|
| Supabase | Database, authentication, Edge Functions | See Supabase project region in our DPA | Transcripts, contacts, account records, MCP tokens, OAuth grants |
| Vercel | Frontend hosting, edge functions, CI/CD | Multi-region (Vercel Edge) | Request logs, deployment metadata (does not include transcript content) |
| Polar | Subscription billing | Per Polar configuration | Billing email, subscription state |
| Stripe | Payment processing (under Polar) | Stripe global | Card data (Stripe-hosted Checkout iframe; never touches CallVault servers) |
| OpenRouter | LLM routing layer for AI-tier MCP tools | Per OpenRouter routing | Transcript text submitted at AI-tool invocation only |
| Anthropic | LLM provider (via OpenRouter) | US | Transcript text submitted at AI-tool invocation only |
| OpenAI | LLM provider (via OpenRouter) | US | Transcript text submitted at AI-tool invocation only |

We commit to notifying customers at least **15 days** before adding a new subprocessor that will process their data.

---

## Data handling

### Where your data lives

Your CallVault data resides primarily in our Supabase project. Access is controlled at the database layer by Row Level Security policies that scope data to your organization and (optionally) workspace.

### What we collect

The minimum required to deliver the service:

- The transcript text and metadata you ingest
- Your account profile (name, email, authentication identifier)
- Your organization and workspace structure
- Records of MCP tokens and OAuth grants you issue
- Operational logs (which tools were called, when, by which organization)

### What we don't do

- We don't train any AI model on your call data
- We don't sell, license, or share customer data with anyone outside the subprocessor list above
- We don't submit your transcripts to LLM subprocessors except when you explicitly invoke an AI-tier MCP tool (`ask_call`, `extract_action_items`, `get_sentiment`, `get_coaching_notes`)

### Retention

We retain your data for the lifetime of your account by default. CallVault is a long-term call intelligence vault, and customers expect data ingested today to remain queryable years from now. You can delete your data at any time:

- **Per-call** in the call detail view
- **Per-workspace** in workspace settings
- **Per-organization** in organization settings
- **Entire account** in Settings → Account
- **By email request** to `support@callvaultai.com` (acknowledged within 2 business days; completed within 30 days)

### Backups

Supabase manages encrypted backups of our production database with retention per their plan tier. We have successfully tested restore from these backups. Deleted data may persist in backup snapshots until the retention window expires.

### Export

You can export your data via the MCP API at any time using the read-tier tools (`list_calls`, `get_transcript`, `list_contacts`, `list_folders`, and others). The full schema is documented in our developer documentation.

---

## Security controls

**Logical access.** Production access is restricted to the single principal of 7X Systems LLC. MFA is enforced on every production admin account. The credential vault is 1Password. All workforce credentials and access reviews are governed by our Access Control Policy.

**Network.** All public CallVault endpoints serve over TLS 1.2+. Inter-service communication between the frontend, Edge Functions, and Supabase uses authenticated and encrypted channels.

**Application.** All production code changes require peer review and are merged to `main` through GitHub branch protection rules. Every MCP tool call passes through a category-gating layer that enforces customer-issued scope before reaching any database query. The boundary is unit-tested in CI.

**Cryptography.** Data at rest is encrypted by Supabase using AES-256. TLS certificates are managed by Vercel and rotate automatically. Secret material (API keys, service role keys) is stored exclusively in 1Password or platform-managed secret stores and is never committed to source control.

**Monitoring.** Sentry monitors the frontend and Edge Functions. Supabase, Vercel, and GitHub provide platform-level audit logs. We perform quarterly access reviews and annual subprocessor reviews. Our internal logging and monitoring posture is documented in our Logging & Monitoring Policy.

**Change management.** Production deploys are auto-triggered by merges to `main` on Vercel. Rollback is instant via the Vercel deployment history. All changes are reviewable in git.

**Incident response.** We maintain an Incident Response Plan that defines detection, classification, containment, eradication, communication, and post-mortem procedures. We have not had a security-relevant incident in the trailing twelve months. When we do, we will report transparently per the Plan.

---

## Compliance posture

| Program | Status |
|---|---|
| SOC 2 Type I | In preparation; external audit planned for 2026 |
| SOC 2 Type II | Targeted after Type I completion |
| GDPR | DPA available on request; subprocessor list public; data deletion supported |
| CCPA / CPRA | Honored on customer request via `support@callvaultai.com` |
| HIPAA | Not a HIPAA-eligible service at this time. Customers with PHI use cases should contact us before ingesting Protected Health Information. |
| PCI DSS | Out of scope — payment data is handled by Stripe-hosted Checkout via Polar; no card data ever reaches CallVault servers |
| ISO 27001 | Not currently pursued |

---

## Send us your security questionnaire

We respond to mid-market and enterprise security questionnaires within 5 business days.

Send your CAIQ, SIG, custom vendor security questionnaire, or DPA to **`support@callvaultai.com`** with `[Security Review]` in the subject line.

Our pre-filled CAIQ-Lite response is available on request for SMB and mid-market evaluations.

---

## Report a vulnerability

If you believe you've found a security vulnerability in CallVault, please email **`support@callvaultai.com`** with `[Security Vulnerability]` in the subject line. We commit to:

- Acknowledge your report within 2 business days
- Provide an initial triage response within 5 business days
- Coordinate disclosure timing with you in good faith

We do not currently operate a paid bug bounty program. We will credit researchers who report responsibly disclosed vulnerabilities, with the researcher's permission.

---

## Status

CallVault is operational. A public status page is provisioned at *(URL to be added once BetterStack / UptimeRobot free tier is set up)*.

---

## Documents

### Public

| Document | URL |
|---|---|
| Terms of Service | [callvaultai.com/terms](https://callvaultai.com/terms) |
| Privacy Policy | [callvaultai.com/privacy](https://callvaultai.com/privacy) |
| Cookie Policy | [callvaultai.com/cookies](https://callvaultai.com/cookies) |

### On request

| Document | Availability |
|---|---|
| Information Security Policy | On request, under NDA |
| Access Control Policy | On request, under NDA |
| Data Classification Policy | On request, under NDA |
| Data Retention & Deletion Policy | On request, under NDA |
| Incident Response Plan | On request, under NDA |
| Vendor & Subprocessor Management Policy | On request, under NDA |
| Data Processing Addendum (DPA) | Coming soon — Common Paper open template adapted to CallVault |
| Pre-filled CAIQ-Lite response | On request |

---

## Last updated

This page was last updated on **2026-05-29**. We refresh it at least quarterly and on any material change to the subprocessor list, security controls, or compliance posture.

---

*Questions: `support@callvaultai.com`*
