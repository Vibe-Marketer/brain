---
title: Buyer Security Review Response Kit
audience: Andrew (or future support/sales-engineering teammate)
purpose: Reduce "send me your security docs" turnaround from hours to minutes
last_updated: 2026-05-31
---

# Buyer Security Review Response Kit

> When a prospect emails `support@callvaultai.com` with a security questionnaire, due-diligence request, or "tell me about your security posture," use this kit. Goal: respond same-day.

## Trigger phrases

Any inbound that contains one of these = use this kit:

- "security review" / "security questionnaire" / "vendor questionnaire"
- "CAIQ" / "SIG" / "VSAQ"
- "send your security docs" / "complete our DPA"
- "is CallVault SOC 2" / "do you have SOC 2"
- "GDPR / DPA / sub-processor list"
- "HIPAA" / "BAA"

## Default response template

Copy-paste, adjust the variables in `{{...}}`, send within 1 business day.

---

**Subject:** Security review materials — CallVault for {{prospect company}}

Hi {{first name}},

Thanks for asking. Here's everything we have. I've kept it tight to make your review efficient.

**Public**

- Trust page (security posture, subprocessors, certifications, deletion paths): https://callvaultai.com/trust
- Terms of Service: https://callvaultai.com/terms
- Privacy Policy: https://callvaultai.com/privacy
- Data Processing Addendum (DPA — Common Paper standard, Controller-to-Processor Module Two): https://callvaultai.com/dpa
- Cookie Policy: https://callvaultai.com/cookies

**Attached** (or available under NDA — see "Want more depth?" below)

- **Pre-filled CAIQ-Lite response** — 16 CSA control families, answered against current state
- **Compliance snapshot** — one-page summary of where we are on SOC 2 Type I prep

**Quick facts you may need on a vendor intake form**

| Field | Value |
|-------|-------|
| Legal entity | 7x Systems LLC (d/b/a CallVault) |
| State of formation | Wyoming, United States |
| Registered address | 1309 Coffeen Ave, Ste 17642, Sheridan, WY 82801 |
| Tax ID (EIN) | (available on request under NDA) |
| Founded | 2024 |
| Headcount with system access | 1 (sole principal) |
| Primary security contact | support@callvaultai.com / +1 315-335-8779 |
| Data hosting region | (Supabase project region — confirm from Supabase dashboard) |
| Encryption in transit | TLS 1.3 with HSTS preload |
| Encryption at rest | AES-256 (Supabase managed) |
| Multi-tenant isolation | Postgres Row Level Security at the database layer + application-layer token scoping; 96+ tables with RLS enabled, 384+ policy statements |
| Backup frequency | Daily (Supabase managed) |
| Backup restore tested | Yes (annually) |
| Public uptime | (link to status page once provisioned) |
| Customer self-serve deletion | Account / Org / Workspace / per-call level |
| Subprocessors | Supabase, Vercel, Polar, Stripe (via Polar), OpenRouter, Anthropic, OpenAI |
| Compliance posture | SOC 2 Type I in preparation; not currently HIPAA-eligible; PCI DSS out of scope (Stripe-hosted checkout) |

**Want more depth?**

I can also share the following under NDA (we don't post these publicly because they describe internal controls):

- Information Security Policy + 17 derivative policies (Access Control, Data Classification, Data Retention, Incident Response, Vendor Management, AI Governance, etc.)
- Risk Register (12 risks with impact × likelihood scoring + treatment)
- SOC 2 readiness self-assessment (current 76% MET against AICPA Trust Services Criteria)
- Phase A evidence vault (DNS/TLS/Supabase/Vercel/GitHub controls evidence)
- Annual security awareness training record
- Quarterly access review records
- Backup & restore runbook

Send me a mutual NDA or accept ours (linked here: [TODO link to NDA template]) and I'll share the same day.

**Custom questionnaire?**

If your team uses a specific questionnaire (SIG-Lite, CAIQ-Lite, your own template), send it and I'll respond within 5 business days. The pre-filled CAIQ-Lite above usually covers 80% of what custom questionnaires ask.

Let me know what else you need — happy to set up a 30-minute call with your security team if it helps.

Best,
Andrew
Andrew Naegele
Principal / Information Security Officer
7x Systems LLC (CallVault)
support@callvaultai.com
+1 315-335-8779

---

## Attachment manifest

Build these once and have them ready:

| File | Where | Status |
|------|-------|--------|
| `caiq-lite-callvault-{YYYY-MM-DD}.pdf` | Export from `.compliance/questionnaires/caiq-lite-callvault.md` | Generated on first send; refresh quarterly |
| `compliance-snapshot-{YYYY-MM-DD}.pdf` | One-page summary from the readiness Rev | Generated on first send; refresh on score change |
| `subprocessor-list-{YYYY-MM-DD}.pdf` | Export from trust page subprocessor table | Refresh on any subprocessor change |
| NDA template (mutual) | Common Paper Mutual NDA, signed-ready | TODO — adopt template |

## Variants

### Variant — buyer asks for SOC 2 specifically

> "We're in active preparation for SOC 2 Type I, targeting external auditor engagement in {{quarter year}}. While we work toward attestation, we inherit material coverage from our infrastructure providers: Supabase (SOC 2 Type II), Vercel (SOC 2 Type II + ISO 27001), Anthropic and OpenAI (both SOC 2 Type II). The trust page details the inheritance chain. The pre-filled CAIQ-Lite response in attachments addresses every Trust Services Criterion line item."

### Variant — buyer asks for HIPAA / wants to ingest PHI

> "CallVault is not currently offered as a HIPAA-eligible service. The infrastructure providers we use (Supabase HIPAA-eligible plans, Anthropic + OpenAI both with BAAs available) would support a HIPAA-eligible variant in the future, but we haven't completed our own HIPAA workspace scoping yet. If HIPAA support is gating your evaluation, let's talk about scope and timeline — we have a roadmap consideration for HIPAA workspaces that's currently demand-gated."

### Variant — buyer asks "do you train AI on our data?"

> "No. Customer transcripts are submitted to AI providers (Anthropic, OpenAI via OpenRouter) only when you explicitly invoke an AI-tier MCP tool. Both Anthropic and OpenAI contractually commit (in their API terms and DPAs) not to train on API-submitted customer data. Our AI Governance Policy (available under NDA) documents the data flow boundaries and provider commitments in detail."

### Variant — buyer asks "show me your sub-processor list"

> Link them directly to `https://callvaultai.com/trust` (subprocessor table is on that page). No additional response needed.

### Variant — buyer asks "what's your data deletion process?"

> "Customers can self-serve delete at four levels — per-call, per-workspace, per-organization, and full-account — all in the CallVault UI. We also accept email deletion requests at `support@callvaultai.com` with a 2-business-day acknowledgment and 30-day completion SLA. Our Data Retention & Deletion Policy (under NDA) and DPA Section 7 cover this in detail."

## After every send — log it

For SOC 2 evidence (and to track buyer demand patterns), log each response in `.compliance/evidence/{YYYY-MM-DD}/buyer-security-reviews/{prospect-slug}.md`:

```yaml
---
date: YYYY-MM-DD
prospect: {{company}}
contact: {{name + email}}
trigger: {{what they asked for}}
docs_sent: [trust-page-link, caiq-lite-pdf, ...]
nda_status: not-requested | requested | signed
follow_up_questions: |
  Any deeper questions they asked
---
```

These logs become the "buyer demand for compliance" evidence the next quarterly review uses to gauge whether to accelerate audit engagement.

## Maintenance discipline

- **Quarterly:** refresh the attached PDFs (CAIQ + compliance snapshot)
- **On any policy change:** re-export the policy library before next send
- **On any subprocessor change:** trust page already auto-updates; refresh the subprocessor PDF
- **Annually:** rotate the talking points based on the past year's buyer questions

## What this kit replaces

Before: each buyer security review takes 2-4 hours to research + assemble + write a response.

After: ≤30 minutes per response. Same-day turnaround. Higher close rate on deals where compliance is a gate.

Closes the loop on the highest-leverage operational impact of the compliance bootstrap: **revenue conversations that don't die in due-diligence.**
