---
title: CallVault Data Processing Addendum (DPA)
version: 1.0
effective_date: 2026-05-29
based_on: Common Paper Data Processing Addendum v2.0 (commonpaper.com/standards/data-processing-addendum)
status: published draft
publication_url: https://callvaultai.com/dpa
---

# Data Processing Addendum

**This Data Processing Addendum ("DPA") is incorporated into and forms part of the agreement (the "Agreement") between Customer and 7x Systems LLC (d/b/a CallVault) ("Provider", "we", "us") governing Customer's use of the CallVault service.**

This DPA is built on the Common Paper Data Processing Addendum, a community-maintained open standard. We use it because it is widely understood by buyers and counsel; CallVault-specific terms are filled into the variable fields below and any deviations from the underlying standard are called out explicitly.

| Field | Value |
|---|---|
| Provider name | 7x Systems LLC (d/b/a CallVault) |
| Provider address | 1309 Coffeen Ave, Ste 17642, Sheridan, WY 82801, United States |
| Provider contact | support@callvaultai.com / +1 315-335-8779 |
| Provider Data Protection Officer | Andrew Naegele (sole principal); support@callvaultai.com |
| Effective date | The date Customer first agrees to the Agreement, or 2026-05-29, whichever is later |
| Governing law | Wyoming, United States (per the Terms of Service at callvaultai.com/terms) |

---

## 1. Definitions

Terms used in this DPA that are not defined here have the meanings given in the Agreement or in the applicable Data Protection Laws.

- **"Customer Personal Data"** means personal data Provider processes on Customer's behalf to deliver the CallVault service. Examples include the content of call transcripts, contact records, account profiles, and any derived AI outputs.
- **"Data Protection Laws"** means all data protection and privacy laws applicable to a party's processing of Customer Personal Data, including the **GDPR**, **UK GDPR**, the **California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act ("CCPA")**, and any other U.S. state privacy laws applicable to either party.
- **"Subprocessor"** means a third party engaged by Provider to process Customer Personal Data on Provider's behalf.
- **"Security Incident"** means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Customer Personal Data transmitted, stored, or otherwise processed by Provider or any Subprocessor.

## 2. Roles and Processing

Provider acts as a **processor** of Customer Personal Data. Customer is the **controller** of Customer Personal Data and is responsible for the lawful basis of processing, the accuracy and quality of the personal data, and obtaining any necessary consents from data subjects.

Provider processes Customer Personal Data:

- Solely to deliver the CallVault service as specified in the Agreement and as instructed by Customer
- In accordance with the terms of this DPA and the Agreement
- For the duration of the Agreement plus any wind-down period agreed by the parties

Provider does **not** sell or share Customer Personal Data within the meaning of the CCPA or any other Data Protection Law.

Provider does **not** train any AI model on Customer Personal Data.

## 3. Description of Processing (Annex)

| Item | Detail |
|---|---|
| Nature and purpose of processing | Provision of the CallVault service — a long-term call intelligence vault for revenue teams. Storage, indexing, search, transcription enrichment, and (when invoked by Customer) AI-assisted summarization, action-item extraction, sentiment analysis, and coaching note generation. |
| Categories of data subjects | Customer's employees and contractors who use the CallVault service; participants in calls Customer ingests into CallVault; Customer's contacts. |
| Categories of personal data | Call transcripts and recording metadata; contact names, email addresses, phone numbers; calendar event metadata; authentication identifiers; derived AI outputs (summaries, action items, sentiment, coaching notes). |
| Special categories of data | Provider does not solicit special category data. Customers operating in healthcare-adjacent verticals are responsible for not ingesting Protected Health Information unless a separate Business Associate Agreement is executed; see Section 11. |
| Duration of processing | Lifetime of the Customer account, subject to Customer-initiated deletion per Section 7. |
| Frequency of transfer | Continuous, in line with Customer's use of the service. |

## 4. Subprocessors

### 4.1 Authorization

Customer provides **general authorization** for Provider to engage Subprocessors to process Customer Personal Data, subject to the requirements of this Section 4.

### 4.2 Current Subprocessor list

The current list of Subprocessors is published at **https://callvaultai.com/trust** and reproduced here as of the effective date:

| Subprocessor | Purpose | Customer data processed |
|---|---|---|
| Supabase | Database, authentication, Edge Functions | All Customer Personal Data (primary storage) |
| Vercel | Frontend hosting, edge functions, CI/CD | Request logs, deployment metadata (does not include transcript content) |
| Polar | Subscription billing of record | Billing email, subscription state |
| Stripe (via Polar) | Payment processing | Card data (Stripe-hosted Checkout iframe; never touches CallVault servers), payment receipts |
| OpenRouter | LLM routing layer for AI-tier MCP tools | Transcript text submitted at AI-tool invocation only |
| Anthropic | LLM provider (via OpenRouter) | Transcript text submitted at AI-tool invocation only |
| OpenAI | LLM provider (via OpenRouter) | Transcript text submitted at AI-tool invocation only |

### 4.3 Notification of changes

Provider will provide Customer with at least **15 days'** advance notice of any addition or replacement of a Subprocessor by updating the trust page at https://callvaultai.com/trust and (where Customer has subscribed) by email. Customer may object to a change by emailing support@callvaultai.com within the notice period. If the parties cannot reach a reasonable resolution, Customer may terminate the affected Service with proportionate refund of pre-paid fees.

### 4.4 Subprocessor obligations

Provider remains responsible for the acts and omissions of its Subprocessors as if they were its own and will enter into a written agreement with each Subprocessor containing data protection terms at least as protective as those in this DPA.

## 5. International Transfers

### 5.1 Standard Contractual Clauses

To the extent Provider's processing involves the transfer of Customer Personal Data from the European Economic Area, the United Kingdom, or Switzerland to a country not subject to an adequacy decision, the parties agree that the **EU Standard Contractual Clauses (Commission Implementing Decision (EU) 2021/914)** and, as applicable, the **UK International Data Transfer Addendum** or the **Swiss Data Protection Act provisions** apply and are incorporated by reference. Provider acts as data importer; Customer as data exporter.

### 5.2 Module selection

The applicable module is **Module Two: Controller to Processor**.

### 5.3 Supplementary measures

Provider implements the security measures described in Section 6 and the EU Standard Contractual Clauses Annex II.

## 6. Security

### 6.1 Security measures

Provider maintains a written information security program and implements appropriate technical and organizational measures designed to protect Customer Personal Data, including:

- **Encryption in transit** — TLS 1.2 or higher on every public endpoint
- **Encryption at rest** — AES-256 via Supabase managed encryption
- **Access control** — Row Level Security at the database layer; multi-factor authentication on all Provider production admin accounts; least-privilege access policy
- **Audit logging** — every MCP tool call logged with organization, tool, and outcome; platform audit logs from Supabase, Vercel, and GitHub retained per platform defaults
- **Change management** — required peer review on every code change to production; rollback capability via Vercel deployment history
- **Vulnerability management** — GitHub Dependabot, secret scanning, code scanning enabled; Sentry production error monitoring
- **Backup and recovery** — Supabase managed backups with periodic restore testing
- **Incident response** — documented Incident Response Plan with detection, containment, eradication, communication, and post-mortem procedures

These measures are documented in Provider's Information Security Policy and derivative policies, available on request under NDA.

### 6.2 Personnel

Provider requires its personnel to maintain the confidentiality of Customer Personal Data and to complete security awareness training at least annually.

## 7. Data Subject Rights and Customer Assistance

### 7.1 Data subject requests

If Provider receives a request from a data subject relating to Customer Personal Data (including requests for access, rectification, erasure, restriction, portability, objection, or non-automated decision-making), Provider will:

- Promptly notify Customer of the request
- Not respond to the request other than to acknowledge receipt and refer the data subject to Customer, unless Customer instructs otherwise or applicable law requires Provider to respond
- Provide reasonable assistance to Customer in responding to the request

### 7.2 Self-serve mechanisms

The CallVault service includes the following self-serve mechanisms that Customer can use to fulfill data subject requests directly:

- **Account deletion** — Settings → Account → Delete Account
- **Organization deletion** — Settings → Organizations → Delete Organization
- **Workspace deletion** — Workspace settings → Delete Workspace
- **Per-call deletion** — Call detail view → Delete; also available via the `delete_call` MCP tool
- **Data export** — read-tier MCP tools (`list_calls`, `get_transcript`, `list_contacts`, `list_folders`)

### 7.3 Email-based requests

Customer may submit deletion or export requests on behalf of data subjects to **support@callvaultai.com**. Provider commits to acknowledge such requests within 2 business days and complete fulfillment within 30 days.

## 8. Security Incident Notification

Provider will notify Customer of a Security Incident affecting Customer Personal Data **without undue delay and in any event within 72 hours** after Provider becomes aware of the incident.

The notification will include, to the extent then known:

- The nature of the Security Incident
- The categories and approximate volume of affected Customer Personal Data
- The likely consequences for Customer and affected data subjects
- Measures Provider has taken or proposes to take to address the incident and mitigate its effects
- A point of contact at Provider for further information

Provider will cooperate with Customer in responding to the Security Incident, including providing reasonable assistance with Customer's notification obligations to data subjects or regulators.

## 9. Audits

### 9.1 Information requests

Provider will make available to Customer all information reasonably necessary to demonstrate compliance with this DPA. This includes:

- Provider's then-current security policy summaries
- Provider's most recent SOC 2 report (when available) under NDA
- Responses to Customer's reasonable security questionnaires (CAIQ-Lite, SIG, or custom) within a reasonable response window

### 9.2 On-site audits

To the extent permitted by Provider's own infrastructure providers, Customer may request an on-site audit on **30 days'** prior written notice, no more than **once per twelve-month period**, conducted during normal business hours and in a manner that does not unreasonably interfere with Provider's operations. The parties will agree in advance on scope, timing, and cost allocation. In lieu of an on-site audit, Provider may satisfy the audit obligation by providing the materials described in Section 9.1.

## 10. Return or Deletion of Data

Upon termination of the Agreement, and at Customer's option, Provider will:

- Return Customer Personal Data to Customer in a structured, commonly-used, machine-readable format (typically via the MCP read-tier tools), or
- Delete Customer Personal Data from Provider's production systems

Provider will complete the chosen action within **30 days** of the termination date. Customer Personal Data may persist in Provider's backups for the duration of the applicable backup retention window. Provider will not restore Customer Personal Data from such backups for any purpose other than disaster recovery.

## 11. Specific Regulatory Schemes

### 11.1 HIPAA

CallVault is **not currently** offered as a HIPAA-eligible service. Customers operating in healthcare-adjacent verticals must not ingest Protected Health Information into CallVault unless and until the parties execute a separate Business Associate Agreement.

### 11.2 Children's data

CallVault is not directed to children under the age of 13 (or the equivalent age in the applicable jurisdiction). Customer warrants that it will not knowingly submit personal data of children to the CallVault service.

### 11.3 CCPA

For the purposes of the CCPA, Provider is a **service provider** and not a **third party** with respect to Customer Personal Data. Provider does not retain, use, sell, share, or disclose Customer Personal Data for any purpose other than the specific business purpose of providing the CallVault service.

## 12. Liability and Conflict

The liability of each party arising out of or related to this DPA is subject to the limitations and exclusions set forth in the Agreement. In the event of any conflict between this DPA and the Agreement, this DPA controls solely with respect to the processing of Customer Personal Data.

## 13. Term and Survival

This DPA takes effect on the Effective Date and continues for the duration of the Agreement. Sections of this DPA that, by their nature, are intended to survive termination (including Sections 10 and 12) survive termination of the Agreement.

## 14. Updates

Provider may update this DPA from time to time to reflect changes in applicable law, the Subprocessor list, or Provider's processing activities. Material updates will be communicated by updating the publication URL at https://callvaultai.com/dpa and, where Customer has subscribed, by email. Customer's continued use of the service following a material update constitutes acceptance of the updated DPA.

## 15. Contact

Questions about this DPA, requests for an executed counterpart, or notices required under this DPA should be sent to:

> **7x Systems LLC**
> **Attn: Data Protection**
> **1309 Coffeen Ave, Ste 17642**
> **Sheridan, WY 82801, United States**
> **support@callvaultai.com**
> **+1 315-335-8779**

---

*This DPA is based on the Common Paper Data Processing Addendum (v2.0), a community-maintained open standard. The Common Paper text is licensed under Creative Commons CC-BY-4.0. CallVault-specific facts have been inserted into the variable fields; no substantive deviations from the underlying standard have been made.*

*Effective date: 2026-05-29 | Version 1.0*
